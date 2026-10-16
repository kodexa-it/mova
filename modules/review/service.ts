import "server-only";

import type { ContentStatus, Prisma } from "@prisma/client";

import { conflict, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import type { AnyContent, Format } from "@/modules/content/formats";
import { framesOf } from "@/modules/content/render/frames";
import { bytesHash, pieceVisualHash, pieceVisualSnapshot, RENDER_VERSION, type VisualContext } from "@/modules/content/render/fingerprint";
import { renderFrameBytes } from "@/modules/content/render/render";
import { visualContextOf } from "@/modules/content/render/visual";
import { approvalStateOf } from "@/modules/review/approval";
import { brandRules } from "@/modules/content/service";
import { reviewBlockers } from "@/modules/review/gate";
import { invalidateApprovals } from "@/modules/review/invalidate";

type Tx = Prisma.TransactionClient;

const decisionSelect = {
  id: true,
  versionId: true,
  outcome: true,
  contentHash: true,
  visualHash: true,
  visual: true,
  renderVersion: true,
  frameHashes: true,
  note: true,
  decidedById: true,
  createdAt: true,
  invalidatedAt: true,
  invalidReason: true,
  version: { select: { number: true } },
} satisfies Prisma.ApprovalDecisionSelect;

// Reglas vigentes de la marca para revalidar: palabras que evita y datos publicables.
async function rules(db: Pick<Tx, "brand">, workspaceId: string) {
  const { wordsToAvoid, proofs } = await brandRules(db, workspaceId);
  return { wordsToAvoid, proofs };
}

// Bloquea la fila de la pieza y devuelve su estado y versión vigente.
async function lockItem(tx: Tx, ctx: WorkspaceContext, itemId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "ContentItem" WHERE "id" = ${itemId} AND "workspaceId" = ${ctx.workspace.id} FOR UPDATE`;
  if (!rows.length) throw notFound();
  const item = await tx.contentItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { id: true, title: true, format: true, status: true, currentVersion: { select: { id: true, number: true, content: true, contentHash: true } } },
  });
  if (!item.currentVersion) throw conflict("invalid_transition");
  return { ...item, currentVersion: item.currentVersion };
}

async function latestApproval(db: Pick<Tx, "approvalDecision">, itemId: string) {
  return db.approvalDecision.findFirst({ where: { itemId, outcome: "APPROVED" }, orderBy: { createdAt: "desc" }, select: decisionSelect });
}

// Pasa una pieza de borrador a revisión. Solo si no tiene nada que la bloquee.
export async function submitForReview(ctx: WorkspaceContext, itemId: string, ipAddress: string | null) {
  requirePermission(ctx, "content.write");
  return getPrisma().$transaction(async (tx) => {
    const item = await lockItem(tx, ctx, itemId);
    if (item.status !== "DRAFT") throw conflict("invalid_transition");
    if (reviewBlockers(item.format, item.currentVersion.content as AnyContent, await rules(tx, ctx.workspace.id)).length) throw conflict("review_blocked");
    await tx.contentItem.update({ where: { id: itemId }, data: { status: "PENDING_APPROVAL" } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "content.submitted",
      targetType: "content",
      targetId: itemId,
      metadata: { title: item.title, version: item.currentVersion.number },
      ipAddress,
    });
    return { status: "PENDING_APPROVAL" as ContentStatus };
  });
}

async function renderFingerprint(format: Format, content: AnyContent, visual: VisualContext) {
  const hashes: string[] = [];
  for (let index = 0; index < framesOf(format, content).length; index++) {
    const bytes = await renderFrameBytes({ format, content, index, ...visual });
    if (!bytes) throw conflict("review_blocked");
    hashes.push(bytesHash(bytes));
  }
  return hashes;
}

// Aprueba la versión que la persona vio (versionId). Renderiza las imágenes y
// guarda su huella: lo aprobado es ese texto con esas imágenes exactas.
export async function approveVersion(ctx: WorkspaceContext, itemId: string, versionId: string, note: string, ipAddress: string | null) {
  requirePermission(ctx, "content.approve");
  const prisma = getPrisma();

  // Las imágenes se renderizan fuera de la transacción (tardan) y se vuelve a
  // comprobar adentro que nada haya cambiado mientras tanto.
  const preview = await prisma.contentItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspace.id },
    select: { format: true, currentVersion: { select: { id: true, content: true } } },
  });
  if (!preview) throw notFound();
  if (preview.currentVersion?.id !== versionId) throw conflict("version_changed");
  const visual = await visualContextOf(prisma, ctx.workspace.id);
  const content = preview.currentVersion.content as AnyContent;
  if (reviewBlockers(preview.format, content, await rules(prisma, ctx.workspace.id)).length) throw conflict("review_blocked");
  const frameHashes = await renderFingerprint(preview.format, content, visual);
  const vHash = pieceVisualHash(preview.format, content, visual);

  return prisma.$transaction(async (tx) => {
    const item = await lockItem(tx, ctx, itemId);
    if (item.currentVersion.id !== versionId) throw conflict("version_changed");
    if (pieceVisualHash(item.format, item.currentVersion.content, await visualContextOf(tx, ctx.workspace.id)) !== vHash) throw conflict("version_changed");
    const latest = await latestApproval(tx, itemId);
    const snapshot = pieceVisualSnapshot(item.format, item.currentVersion.content, visual);
    const state = approvalStateOf(latest, { versionId: item.currentVersion.id, contentHash: item.currentVersion.contentHash, visualHash: vHash, visual: snapshot });
    // Se aprueba lo que está en revisión, o algo aprobado cuya aprobación ya no vale.
    const approvable = item.status === "PENDING_APPROVAL" || (item.status === "APPROVED" && state.kind === "stale");
    if (!approvable) throw conflict(state.kind === "valid" ? "already_approved" : "invalid_transition");
    if (reviewBlockers(item.format, item.currentVersion.content as AnyContent, await rules(tx, ctx.workspace.id)).length) throw conflict("review_blocked");

    if (state.kind === "stale" && !state.decision.invalidatedAt) await invalidateApprovals(tx, [itemId], state.reason);
    const decision = await tx.approvalDecision.create({
      data: {
        workspaceId: ctx.workspace.id,
        itemId,
        versionId,
        outcome: "APPROVED",
        contentHash: item.currentVersion.contentHash,
        visualHash: vHash,
        renderVersion: RENDER_VERSION,
        frameHashes,
        visual: snapshot,
        note,
        decidedById: ctx.user.id,
      },
      select: { id: true },
    });
    await tx.contentItem.update({ where: { id: itemId }, data: { status: "APPROVED" } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "content.approved",
      targetType: "content",
      targetId: itemId,
      metadata: { title: item.title, version: item.currentVersion.number, decisionId: decision.id },
      ipAddress,
    });
    return { status: "APPROVED" as ContentStatus, decisionId: decision.id };
  });
}

// Pide cambios sobre la versión en revisión: la pieza vuelve a borrador con el
// pedido como comentario.
export async function requestChanges(ctx: WorkspaceContext, itemId: string, versionId: string, note: string, ipAddress: string | null) {
  requirePermission(ctx, "content.requestChanges");
  return getPrisma().$transaction(async (tx) => {
    const item = await lockItem(tx, ctx, itemId);
    if (item.status !== "PENDING_APPROVAL") throw conflict("invalid_transition");
    if (item.currentVersion.id !== versionId) throw conflict("version_changed");
    await tx.approvalDecision.create({
      data: { workspaceId: ctx.workspace.id, itemId, versionId, outcome: "CHANGES_REQUESTED", contentHash: item.currentVersion.contentHash, note, decidedById: ctx.user.id },
    });
    await tx.comment.create({ data: { workspaceId: ctx.workspace.id, itemId, versionId, authorId: ctx.user.id, kind: "CHANGE_REQUEST", body: note } });
    await tx.contentItem.update({ where: { id: itemId }, data: { status: "DRAFT" } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "content.changes_requested",
      targetType: "content",
      targetId: itemId,
      metadata: { title: item.title, version: item.currentVersion.number },
      ipAddress,
    });
    return { status: "DRAFT" as ContentStatus };
  });
}

export async function addComment(ctx: WorkspaceContext, itemId: string, body: string) {
  requirePermission(ctx, "content.comment");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id: itemId, workspaceId: ctx.workspace.id }, select: { currentVersionId: true } });
  if (!item) throw notFound();
  return prisma.comment.create({
    data: { workspaceId: ctx.workspace.id, itemId, versionId: item.currentVersionId, authorId: ctx.user.id, body },
    select: { id: true, createdAt: true },
  });
}

// Estado de la aprobación de la pieza tal como está hoy. Lo usan la revisión,
// la exportación y el registro de publicación.
export async function approvalOf(
  db: Pick<Tx, "approvalDecision" | "brand" | "workspace">,
  workspaceId: string,
  item: { id: string; format: Format; currentVersionId: string | null; contentHash: string | null; content: unknown },
) {
  const [latest, visual] = await Promise.all([latestApproval(db, item.id), visualContextOf(db, workspaceId)]);
  const current = {
    versionId: item.currentVersionId,
    contentHash: item.contentHash,
    visualHash: pieceVisualHash(item.format, item.content, visual),
    visual: pieceVisualSnapshot(item.format, item.content, visual),
  };
  return { state: approvalStateOf(latest, current), visual };
}

export async function getReview(ctx: WorkspaceContext, itemId: string) {
  requirePermission(ctx, "workspace.read");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspace.id },
    select: { id: true, format: true, status: true, currentVersionId: true, currentVersion: { select: { content: true, contentHash: true, number: true } } },
  });
  if (!item) throw notFound();
  const [{ state }, comments, decisions, currentRules] = await Promise.all([
    approvalOf(prisma, ctx.workspace.id, { id: item.id, format: item.format, currentVersionId: item.currentVersionId, contentHash: item.currentVersion?.contentHash ?? null, content: item.currentVersion?.content ?? null }),
    prisma.comment.findMany({
      where: { itemId, workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, body: true, authorId: true, versionId: true, createdAt: true },
      take: 300,
    }),
    prisma.approvalDecision.findMany({ where: { itemId, workspaceId: ctx.workspace.id }, orderBy: { createdAt: "asc" }, select: decisionSelect }),
    rules(prisma, ctx.workspace.id),
  ]);
  const people = new Set([...comments.map((c) => c.authorId), ...decisions.map((d) => d.decidedById)].filter((id): id is string => Boolean(id)));
  const users = people.size ? await prisma.user.findMany({ where: { id: { in: [...people] } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const versionNumbers = new Map(
    (await prisma.contentVersion.findMany({ where: { itemId, workspaceId: ctx.workspace.id }, select: { id: true, number: true } })).map((v) => [v.id, v.number]),
  );

  return {
    status: item.status,
    currentVersion: item.currentVersionId ? { id: item.currentVersionId, number: item.currentVersion!.number } : null,
    approval: state,
    blockers: item.currentVersion ? reviewBlockers(item.format, item.currentVersion.content as AnyContent, currentRules) : [],
    comments: comments.map((c) => ({ ...c, author: c.authorId ? (nameOf.get(c.authorId) ?? "Alguien") : "Alguien", versionNumber: c.versionId ? (versionNumbers.get(c.versionId) ?? null) : null })),
    decisions: decisions.map((d) => ({ ...d, decidedBy: d.decidedById ? (nameOf.get(d.decidedById) ?? "Alguien") : "Alguien" })),
  };
}

export type Review = Awaited<ReturnType<typeof getReview>>;
