import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import { badRequest, conflict, HttpError, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { AiProviderError } from "@/modules/ai/providers/types";
import { recordAudit } from "@/modules/audit/service";
import { canTransition } from "@/modules/content/status";
import { APIFY_POST_MICROS, fetchPostMetrics } from "@/modules/metrics/apify";
import { measuredPosts } from "@/modules/metrics/learnings";
import { computeLearnings, interactions, manualMetricsSchema, MATURE_HOURS, shortcodeOf, type ManualMetrics } from "@/modules/metrics/model";
import { approvalOf } from "@/modules/review/service";

export const publicationSchema = z.object({
  publishedAt: z.string().datetime({ offset: true }),
  permalink: z.string().trim().url().max(300),
});

const ageHours = (publishedAt: Date, at: Date) => Math.max(0, Math.floor((at.getTime() - publishedAt.getTime()) / 3_600_000));

// Registra que la pieza se publicó. Solo con la aprobación vigente de la
// versión actual (descargar o exportar no cuenta como publicar). Queda atada a
// esa versión y esa aprobación, y la pieza pasa a Publicado (ya no se edita).
export async function recordPublication(ctx: WorkspaceContext, itemId: string, input: z.infer<typeof publicationSchema>, ipAddress: string | null) {
  requirePermission(ctx, "content.publishManual");
  const shortcode = shortcodeOf(input.permalink);
  if (!shortcode) throw badRequest("invalid_permalink");
  const publishedAt = new Date(input.publishedAt);
  if (publishedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest("publication_in_future");
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ContentItem" WHERE "id" = ${itemId} AND "workspaceId" = ${ctx.workspace.id} FOR UPDATE`;
    if (!rows.length) throw notFound();
    const item = await tx.contentItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { id: true, title: true, format: true, status: true, currentVersionId: true, currentVersion: { select: { content: true, contentHash: true, number: true } }, publication: { select: { id: true } } },
    });
    if (item.publication) throw conflict("already_published");
    if (!canTransition(item.status, "PUBLISHED")) throw conflict("not_approved");
    const { state } = await approvalOf(tx, ctx.workspace.id, { id: item.id, format: item.format, currentVersionId: item.currentVersionId, contentHash: item.currentVersion?.contentHash ?? null, content: item.currentVersion?.content ?? null });
    if (state.kind !== "valid") throw conflict("not_approved");
    let publication;
    try {
      publication = await tx.publication.create({
        data: { workspaceId: ctx.workspace.id, itemId, versionId: item.currentVersionId!, approvalId: state.decision.id, publishedAt, permalink: input.permalink.trim(), shortcode, recordedById: ctx.user.id },
        select: { id: true, publishedAt: true, permalink: true, shortcode: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("permalink_used");
      throw error;
    }
    await tx.contentItem.update({ where: { id: itemId }, data: { status: "PUBLISHED", scheduledFor: publishedAt } });
    await recordAudit(tx, { workspaceId: ctx.workspace.id, actorUserId: ctx.user.id, action: "content.published", targetType: "content", targetId: itemId, metadata: { title: item.title, version: item.currentVersion?.number ?? null, permalink: publication.permalink }, ipAddress });
    return publication;
  });
}

async function publicationOf(ctx: WorkspaceContext, publicationId: string) {
  const pub = await getPrisma().publication.findFirst({ where: { id: publicationId, workspaceId: ctx.workspace.id }, select: { id: true, publishedAt: true, permalink: true, shortcode: true } });
  if (!pub) throw notFound();
  return pub;
}

// Métricas cargadas a mano desde las estadísticas de Instagram (alcance,
// guardados, compartidos, visitas al perfil, consultas comerciales).
export async function addManualMetrics(ctx: WorkspaceContext, publicationId: string, input: ManualMetrics) {
  requirePermission(ctx, "metrics.writeManual");
  const parsed = manualMetricsSchema.parse(input);
  const pub = await publicationOf(ctx, publicationId);
  const capturedAt = parsed.capturedAt ? new Date(parsed.capturedAt) : new Date();
  if (capturedAt < pub.publishedAt || capturedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest("invalid_capture_date");
  const values = { likes: parsed.likes ?? null, comments: parsed.comments ?? null, plays: parsed.plays ?? null, saves: parsed.saves ?? null, shares: parsed.shares ?? null, reach: parsed.reach ?? null, profileVisits: parsed.profileVisits ?? null, inquiries: parsed.inquiries ?? null };
  if (Object.values(values).every((v) => v === null)) throw badRequest("no_metrics");
  return getPrisma().metricSnapshot.create({
    data: { workspaceId: ctx.workspace.id, publicationId, source: "MANUAL", capturedAt, ageHours: ageHours(pub.publishedAt, capturedAt), recordedById: ctx.user.id, ...values },
    select: { id: true, ageHours: true },
  });
}

// Lee las métricas públicas con Apify (llamada paga, ~USD 0,0027): solo con
// confirmación explícita, token en el servidor y un tope de gasto por ejecución.
export async function fetchPublicMetrics(ctx: WorkspaceContext, publicationId: string) {
  requirePermission(ctx, "metrics.writeManual");
  const token = getEnv().APIFY_TOKEN;
  if (!token) throw new HttpError(503, "apify_not_configured");
  const pub = await publicationOf(ctx, publicationId);
  let metrics;
  try {
    metrics = await fetchPostMetrics(token, pub.permalink);
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "unexpected";
    console.error(`[metricas] apify falló para ${pub.id}: ${code}${error instanceof AiProviderError && error.detail ? ` (${error.detail})` : ""}`);
    throw new HttpError(502, code === "provider_no_data" ? "apify_no_data" : code === "provider_auth" ? "apify_auth" : "apify_failed");
  }
  const capturedAt = new Date();
  return getPrisma().metricSnapshot.create({
    data: { workspaceId: ctx.workspace.id, publicationId, source: "APIFY_PUBLIC", capturedAt, ageHours: ageHours(pub.publishedAt, capturedAt), likes: metrics.likes, comments: metrics.comments, plays: metrics.plays, costMicros: APIFY_POST_MICROS, recordedById: ctx.user.id },
    select: { id: true, likes: true, comments: true, plays: true, ageHours: true, costMicros: true },
  });
}

// Panel de resultados: publicaciones con su última medición y los aprendizajes.
export async function getResults(ctx: WorkspaceContext) {
  requirePermission(ctx, "workspace.read");
  const prisma = getPrisma();
  const [pubs, measured] = await Promise.all([
    prisma.publication.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: {
        id: true,
        publishedAt: true,
        permalink: true,
        item: { select: { id: true, title: true, format: true, pillar: true } },
        snapshots: { orderBy: { capturedAt: "desc" }, take: 10, select: { id: true, source: true, capturedAt: true, ageHours: true, likes: true, comments: true, plays: true, saves: true, shares: true, reach: true, profileVisits: true, inquiries: true, costMicros: true } },
      },
    }),
    measuredPosts(ctx.workspace.id),
  ]);
  const learnings = computeLearnings(measured);
  return {
    learnings,
    apifyConfigured: Boolean(getEnv().APIFY_TOKEN),
    publications: pubs.map((p) => {
      const latest = (k: "likes" | "comments" | "plays" | "saves" | "shares" | "reach" | "profileVisits" | "inquiries") => p.snapshots.find((s) => s[k] !== null)?.[k] ?? null;
      const summary = { likes: latest("likes"), comments: latest("comments"), plays: latest("plays"), saves: latest("saves"), shares: latest("shares"), reach: latest("reach"), profileVisits: latest("profileVisits"), inquiries: latest("inquiries") };
      return { ...p, summary, interactions: interactions(summary), mature: p.snapshots.some((s) => s.ageHours >= MATURE_HOURS) };
    }),
  };
}

// Piezas aprobadas que todavía no se registraron como publicadas.
export async function listPublishable(ctx: WorkspaceContext) {
  requirePermission(ctx, "workspace.read");
  return getPrisma().contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, status: { in: ["APPROVED", "SCHEDULED"] }, publication: null },
    orderBy: { scheduledFor: "asc" },
    take: 50,
    select: { id: true, title: true, format: true, scheduledFor: true },
  });
}

export async function publicationOfItem(ctx: WorkspaceContext, itemId: string) {
  requirePermission(ctx, "workspace.read");
  return getPrisma().publication.findFirst({ where: { itemId, workspaceId: ctx.workspace.id }, select: { id: true, publishedAt: true, permalink: true } });
}
