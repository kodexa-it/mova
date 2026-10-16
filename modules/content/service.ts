import "server-only";

import type { ContentStatus, Prisma, VersionAuthor } from "@prisma/client";

import { badRequest, conflict, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import { emptyContent, FORMAT_SCHEMAS, type AnyContent, type Format } from "@/modules/content/formats";
import { contentHash } from "@/modules/content/hash";
import { changeReason } from "@/modules/content/change";
import { artRefsOf, normalizeDesigns, type ProofSnapshot } from "@/modules/content/layouts";
import { canTransition, statusAfterEdit } from "@/modules/content/status";
import { validateContent } from "@/modules/content/validators";
import { resolveSlot, type Slot } from "@/modules/plans/slots";
import { invalidateApprovals } from "@/modules/review/invalidate";

const itemSelect = {
  id: true,
  format: true,
  title: true,
  pillar: true,
  goal: true,
  angle: true,
  status: true,
  visualMode: true,
  scheduledFor: true,
  regenerations: true,
  createdAt: true,
  updatedAt: true,
  currentVersion: { select: { id: true, number: true, verdict: true, author: true, createdAt: true } },
} satisfies Prisma.ContentItemSelect;

export async function listContent(ctx: WorkspaceContext, filter: { status?: ContentStatus | "ACTIVE" } = {}) {
  requirePermission(ctx, "workspace.read");
  const where: Prisma.ContentItemWhereInput = { workspaceId: ctx.workspace.id };
  if (filter.status === "ACTIVE" || !filter.status) where.status = { not: "ARCHIVED" };
  else where.status = filter.status;
  return getPrisma().contentItem.findMany({ where, orderBy: { updatedAt: "desc" }, select: itemSelect, take: 200 });
}

export async function getContent(ctx: WorkspaceContext, id: string) {
  requirePermission(ctx, "workspace.read");
  const item = await getPrisma().contentItem.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    select: {
      ...itemSelect,
      currentVersion: { select: { id: true, number: true, verdict: true, author: true, createdAt: true, content: true, validation: true, contentHash: true } },
      versions: { orderBy: { number: "desc" }, select: { id: true, number: true, author: true, authorUserId: true, verdict: true, createdAt: true, llmCallId: true } },
    },
  });
  if (!item) throw notFound();
  // Costo de cada versión escrita por la IA (etapa 3: costo por pieza medido).
  const callIds = item.versions.map((v) => v.llmCallId).filter((id): id is string => Boolean(id));
  const calls = callIds.length
    ? await getPrisma().llmCall.findMany({ where: { id: { in: callIds }, workspaceId: ctx.workspace.id }, select: { id: true, costMicros: true } })
    : [];
  const cost = new Map(calls.map((c) => [c.id, c.costMicros]));
  return { ...item, versions: item.versions.map((v) => ({ ...v, costMicros: v.llmCallId ? (cost.get(v.llmCallId) ?? null) : null })) };
}

// Reglas de la marca con las que se valida una versión: palabras que evita y
// datos publicables (los únicos que puede mostrar el layout "Dato grande").
export async function brandRules(tx: Pick<Prisma.TransactionClient, "brand">, workspaceId: string) {
  const brand = await tx.brand.findUnique({
    where: { workspaceId },
    select: { id: true, voice: { select: { wordsToAvoid: true } }, proofs: { orderBy: { position: "asc" }, select: { id: true, statement: true, source: true } } },
  });
  return { brandId: brand?.id ?? null, wordsToAvoid: brand?.voice?.wordsToAvoid ?? [], proofs: brand?.proofs ?? [] };
}

export interface CreateContentInput {
  format: Format;
  title: string;
  pillar?: string | null;
  goal?: string | null;
  angle?: string;
  slot?: Slot | null;
  visualMode?: "STANDARD" | "AI";
}

// Crea la pieza con una primera versión vacía (borrador). Con fecha, entra al
// plan de esa semana.
export async function createContent(ctx: WorkspaceContext, input: CreateContentInput, ipAddress: string | null) {
  requirePermission(ctx, "content.write");
  if (input.slot) requirePermission(ctx, "plan.write");
  return getPrisma().$transaction((tx) => createDraftItem(tx, ctx, input, ipAddress));
}

// Crea la pieza dentro de una transacción ya abierta (la usa también la
// aprobación de la estrategia semanal, que crea varias piezas juntas).
export async function createDraftItem(tx: Prisma.TransactionClient, ctx: WorkspaceContext, input: CreateContentInput, ipAddress: string | null) {
  const { brandId, wordsToAvoid, proofs } = await brandRules(tx, ctx.workspace.id);
  const schedule = await resolveSlot(tx, ctx.workspace.id, input.slot ?? null, ctx.user.id);
  const item = await tx.contentItem.create({
    data: {
      workspaceId: ctx.workspace.id,
      brandId,
      format: input.format,
      title: input.title,
      pillar: input.pillar || null,
      goal: input.goal || null,
      angle: input.angle ?? "",
      visualMode: input.visualMode ?? "STANDARD",
      ...schedule,
      createdById: ctx.user.id,
    },
    select: { id: true },
  });
  const content = emptyContent(input.format);
  await insertVersion(tx, ctx, item.id, input.format, content, { author: "USER", wordsToAvoid, proofs, number: 1 });
  await recordAudit(tx, {
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "content.created",
    targetType: "content",
    targetId: item.id,
    metadata: { title: input.title, format: input.format, ...(input.slot ? { date: input.slot.date } : {}) },
    ipAddress,
  });
  return item;
}

async function insertVersion(
  tx: Prisma.TransactionClient,
  ctx: WorkspaceContext,
  itemId: string,
  format: Format,
  content: AnyContent,
  opts: { author: VersionAuthor; wordsToAvoid: string[]; proofs: ProofSnapshot[]; number: number; llmCallId?: string },
) {
  const validation = validateContent(format, content, { wordsToAvoid: opts.wordsToAvoid, proofs: opts.proofs });
  const version = await tx.contentVersion.create({
    data: {
      workspaceId: ctx.workspace.id,
      itemId,
      number: opts.number,
      author: opts.author,
      authorUserId: opts.author === "USER" ? ctx.user.id : null,
      llmCallId: opts.llmCallId ?? null,
      content: content as unknown as Prisma.InputJsonValue,
      contentHash: contentHash(content),
      validation: validation as unknown as Prisma.InputJsonValue,
      verdict: validation.verdict,
    },
    select: { id: true, number: true, verdict: true },
  });
  await tx.contentItem.update({ where: { id: itemId }, data: { currentVersionId: version.id } });
  return version;
}

// Guarda una versión nueva. Si el contenido es idéntico al vigente no crea
// nada. Si la pieza estaba pendiente, aprobada o programada, vuelve a borrador.
export async function saveVersion(
  ctx: WorkspaceContext,
  itemId: string,
  rawContent: unknown,
  opts: { author?: VersionAuthor; llmCallId?: string } = {},
) {
  requirePermission(ctx, "content.write");
  return getPrisma().$transaction(async (tx) => {
    // Bloquea la fila: dos guardados simultáneos no pueden tomar el mismo número.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ContentItem" WHERE "id" = ${itemId} AND "workspaceId" = ${ctx.workspace.id} FOR UPDATE`;
    if (!rows.length) throw notFound();
    const item = await tx.contentItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { format: true, status: true, currentVersion: { select: { contentHash: true, number: true, content: true } } },
    });
    const parsed = FORMAT_SCHEMAS[item.format].safeParse(rawContent);
    if (!parsed.success) throw badRequest();
    // "Clásico" se guarda como ausencia de diseño: el hash de una pieza sin
    // composiciones elegidas es el mismo que antes de existir los layouts.
    const content = normalizeDesigns(item.format, parsed.data as AnyContent);

    const next = statusAfterEdit(item.status);
    if (next === "locked") throw conflict("content_locked");
    if (item.currentVersion?.contentHash === contentHash(content)) return { changed: false as const, status: item.status };

    await assertArtAvailable(tx, ctx.workspace.id, itemId, item.format, content);
    const { wordsToAvoid, proofs } = await brandRules(tx, ctx.workspace.id);
    const last = await tx.contentVersion.aggregate({ where: { itemId }, _max: { number: true } });
    const version = await insertVersion(tx, ctx, itemId, item.format, content, {
      author: opts.author ?? "USER",
      wordsToAvoid,
      proofs,
      number: (last._max.number ?? 0) + 1,
      llmCallId: opts.llmCallId,
    });
    if (item.status !== next) await tx.contentItem.update({ where: { id: itemId }, data: { status: next } });
    // La aprobación valía para la versión anterior. El motivo dice qué cambió.
    await invalidateApprovals(tx, [itemId], changeReason(item.format, item.currentVersion?.content ?? null, content));
    return { changed: true as const, status: next, version };
  });
}

export async function updateContentMeta(ctx: WorkspaceContext, itemId: string, data: { title?: string; pillar?: string | null; goal?: string | null; angle?: string; visualMode?: "STANDARD" | "AI" }) {
  requirePermission(ctx, "content.write");
  const result = await getPrisma().contentItem.updateMany({ where: { id: itemId, workspaceId: ctx.workspace.id }, data });
  if (!result.count) throw notFound();
}

export async function setArchived(ctx: WorkspaceContext, itemId: string, archived: boolean, ipAddress: string | null) {
  requirePermission(ctx, "content.write");
  return getPrisma().$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({ where: { id: itemId, workspaceId: ctx.workspace.id }, select: { status: true, title: true } });
    if (!item) throw notFound();
    const to: ContentStatus = archived ? "ARCHIVED" : "DRAFT";
    if (item.status === to) return { status: to };
    if (!canTransition(item.status, to)) throw conflict("invalid_transition");
    await tx.contentItem.update({ where: { id: itemId }, data: { status: to } });
    if (archived) await invalidateApprovals(tx, [itemId], "archived");
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: archived ? "content.archived" : "content.restored",
      targetType: "content",
      targetId: itemId,
      metadata: { title: item.title },
      ipAddress,
    });
    return { status: to };
  });
}

// Una versión solo puede usar imágenes generadas de esta misma pieza y
// workspace, con la huella exacta del archivo guardado.
async function assertArtAvailable(tx: Prisma.TransactionClient, workspaceId: string, itemId: string, format: Format, content: AnyContent) {
  const refs = artRefsOf(format, content as unknown as Record<string, unknown>);
  if (!refs.length) return;
  const ids = [...new Set(refs.map((r) => r.art.assetId))];
  const found = await tx.imageAsset.findMany({ where: { id: { in: ids }, workspaceId, itemId }, select: { id: true, sha256: true } });
  const ok = new Map(found.map((a) => [a.id, a.sha256]));
  if (refs.some((r) => ok.get(r.art.assetId) !== r.art.sha256)) throw badRequest("art_not_found");
}
