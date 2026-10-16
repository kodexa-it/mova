import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma, type Job } from "@prisma/client";

import { conflict, HttpError } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { addDays, todayIn, zonedYmd } from "@/lib/time";
import { backgroundContext, requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { markCallOutputInvalid, runAi } from "@/modules/ai/gateway";
import { extractJson } from "@/modules/ai/json";
import { getProvider } from "@/modules/ai/providers/registry";
import { recordAudit } from "@/modules/audit/service";
import { brandProgress } from "@/modules/brand/completeness";
import { getBrand, shapeOf, type BrandProfile } from "@/modules/brand/service";
import type { AnyContent, Format } from "@/modules/content/formats";
import { generatePiece } from "@/modules/content/generate";
import { brandRules, createDraftItem } from "@/modules/content/service";
import { enqueue, PermanentJobError } from "@/modules/jobs/queue";
import { learningsFor } from "@/modules/metrics/learnings";
import { notifyPermission } from "@/modules/notifications/service";
import { calendarZone, ensurePlan, weekDate } from "@/modules/plans/slots";
import {
  MAX_SLOTS,
  pieceInstructions,
  STRATEGY_PROMPT_VERSION,
  STRATEGY_SYSTEM,
  strategyFromAnswer,
  strategyPrompt,
  strategySchema,
  type StrategyStored,
} from "@/modules/plans/strategy-model";
import { reviewBlockers } from "@/modules/review/gate";
import { submitForReview } from "@/modules/review/service";

export const GENERATE_JOB = "content.generate";
const newKey = () => randomBytes(6).toString("hex");
const groupOf = (planId: string) => `plan:${planId}`;

export function brandContextOf(brand: BrandProfile) {
  return {
    name: brand.name,
    industry: brand.industry,
    description: brand.description,
    website: brand.website,
    offerings: brand.offerings,
    audiences: brand.audiences,
    goals: brand.goals,
    pillars: brand.pillars,
    proofs: brand.proofs,
    rules: brand.rules,
    voice: brand.voice,
  };
}

async function planOf(ctx: WorkspaceContext, weekStart: string) {
  return getPrisma().contentPlan.findUnique({
    where: { workspaceId_weekStart: { workspaceId: ctx.workspace.id, weekStart: weekDate(weekStart) } },
    select: { id: true, focus: true, strategyStatus: true, strategy: true, strategyProposedAt: true, strategyApprovedAt: true, strategyApprovedById: true },
  });
}

// Estado de la estrategia de una semana y, si se aprobó, el avance de la
// generación en segundo plano.
export async function getStrategy(ctx: WorkspaceContext, weekStart: string) {
  requirePermission(ctx, "workspace.read");
  const plan = await planOf(ctx, weekStart);
  if (!plan) return { status: "NONE" as const, focus: "", strategy: null, progress: null };
  let progress = null;
  if (plan.strategyStatus === "APPROVED") {
    const prisma = getPrisma();
    const jobs = await prisma.job.findMany({ where: { workspaceId: ctx.workspace.id, groupKey: groupOf(plan.id) }, select: { status: true, payload: true, lastError: true, result: true } });
    const itemIds = jobs.map((j) => (j.payload as { itemId: string }).itemId);
    const items = await prisma.contentItem.findMany({ where: { id: { in: itemIds }, workspaceId: ctx.workspace.id }, select: { id: true, title: true, format: true, status: true } });
    const byId = new Map(items.map((i) => [i.id, i]));
    progress = {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING").length,
      done: jobs.filter((j) => j.status === "SUCCEEDED").length,
      failed: jobs.filter((j) => j.status === "FAILED").length,
      items: jobs.map((j) => {
        const id = (j.payload as { itemId: string }).itemId;
        return { id, job: j.status, error: j.status === "FAILED" ? j.lastError : null, item: byId.get(id) ?? null };
      }),
    };
  }
  return { status: plan.strategyStatus, focus: plan.focus, strategy: (plan.strategy as unknown as StrategyStored | null) ?? null, progress, approvedAt: plan.strategyApprovedAt };
}

// La IA propone la semana a partir del foco. No crea piezas ni cobra imágenes:
// solo una llamada de texto (presupuesto de IA del workspace).
export async function proposeStrategy(ctx: WorkspaceContext, weekStart: string, input: { count: number; instructions: string }, ipAddress: string | null) {
  requirePermission(ctx, "plan.write");
  if (!getProvider()) throw conflict("ai_unavailable");
  const prisma = getPrisma();
  const brand = await getBrand(ctx);
  if (!brand || !brandProgress(shapeOf(brand)).isComplete) throw conflict("brand_incomplete");
  const zone = await calendarZone(prisma, ctx.workspace.id);
  const today = todayIn(zone);
  if (addDays(weekStart, 6) < today) throw conflict("week_past");
  const existing = await planOf(ctx, weekStart);
  if (!existing?.focus.trim()) throw conflict("focus_required");
  if (existing.strategyStatus === "APPROVED") throw conflict("strategy_approved");

  const from = weekDate(weekStart);
  const [scheduled, recent, learnings] = await Promise.all([
    prisma.contentItem.findMany({ where: { workspaceId: ctx.workspace.id, planId: existing.id, status: { not: "ARCHIVED" } }, select: { scheduledFor: true, format: true, title: true } }),
    prisma.contentItem.findMany({
      where: { workspaceId: ctx.workspace.id, createdAt: { gte: new Date(from.getTime() - 42 * 86_400_000) }, status: { not: "ARCHIVED" }, planId: { not: existing.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, angle: true, format: true },
    }),
    learningsFor(ctx.workspace.id),
  ]);
  const prompt = strategyPrompt({
    brand: brandContextOf(brand),
    weekStart,
    today,
    focus: existing.focus,
    count: input.count,
    instructions: input.instructions,
    scheduled: scheduled.filter((s) => s.scheduledFor).map((s) => ({ date: zonedYmd(s.scheduledFor!, zone), format: s.format as Format, title: s.title })),
    recent: recent.map((r) => ({ title: r.title, angle: r.angle, format: r.format as Format })),
    learnings,
  });
  const { text, callId } = await runAi(ctx, {
    operation: "plan.strategy",
    tier: "smart",
    system: `${STRATEGY_SYSTEM}\n(Versión del prompt: ${STRATEGY_PROMPT_VERSION})`,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 3000,
  });
  const answer = strategyFromAnswer(extractJson(text), {
    weekStart,
    today,
    count: input.count,
    pillars: brand.pillars.map((p) => p.name),
    goals: brand.goals.map((g) => g.title),
    newKey,
  });
  if (!answer) {
    await markCallOutputInvalid(callId);
    throw new HttpError(502, "ai_invalid_output");
  }
  const stored: StrategyStored = { ...answer.strategy, promptVersion: STRATEGY_PROMPT_VERSION };
  await prisma.$transaction(async (tx) => {
    await tx.contentPlan.update({
      where: { id: existing.id },
      data: { strategy: stored as unknown as Prisma.InputJsonValue, strategyStatus: "PROPOSED", strategyLlmCallId: callId, strategyProposedAt: new Date(), source: "AI" },
    });
    await recordAudit(tx, { workspaceId: ctx.workspace.id, actorUserId: ctx.user.id, action: "plan.strategy_proposed", targetType: "plan", targetId: existing.id, metadata: { week: weekStart, slots: stored.slots.length, dropped: answer.dropped }, ipAddress });
  });
  return { strategy: stored, dropped: answer.dropped };
}

// La persona edita la propuesta (quita filas, cambia fecha, formato, tema o
// ángulo) antes de aprobarla.
export async function updateStrategy(ctx: WorkspaceContext, weekStart: string, raw: unknown) {
  requirePermission(ctx, "plan.write");
  const plan = await planOf(ctx, weekStart);
  if (!plan || plan.strategyStatus !== "PROPOSED") throw conflict("strategy_not_proposed");
  const parsed = strategySchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid_input");
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  if (parsed.data.slots.some((s) => !week.has(s.date))) throw new HttpError(400, "invalid_input");
  const previous = plan.strategy as unknown as StrategyStored;
  const stored: StrategyStored = { ...parsed.data, promptVersion: previous?.promptVersion ?? STRATEGY_PROMPT_VERSION };
  await getPrisma().contentPlan.update({ where: { id: plan.id }, data: { strategy: stored as unknown as Prisma.InputJsonValue } });
  return { strategy: stored };
}

export async function discardStrategy(ctx: WorkspaceContext, weekStart: string) {
  requirePermission(ctx, "plan.write");
  const plan = await planOf(ctx, weekStart);
  if (!plan || plan.strategyStatus !== "PROPOSED") throw conflict("strategy_not_proposed");
  await getPrisma().contentPlan.update({ where: { id: plan.id }, data: { strategyStatus: "NONE", strategy: Prisma.DbNull } });
}

// Aprueba la estrategia: crea una pieza por fila (borrador, con su fecha) y
// encola su generación. Nada se publica: cada pieza pasa después por su propia
// revisión y aprobación.
export async function approveStrategy(ctx: WorkspaceContext, weekStart: string, input: { visualMode: "STANDARD" | "AI" }, ipAddress: string | null) {
  requirePermission(ctx, "plan.write");
  requirePermission(ctx, "content.write");
  const prisma = getPrisma();
  const brand = await getBrand(ctx);
  if (!brand || !brandProgress(shapeOf(brand)).isComplete) throw conflict("brand_incomplete");
  const today = todayIn(await calendarZone(prisma, ctx.workspace.id));
  return prisma.$transaction(async (tx) => {
    // Bloquea el plan: dos aprobaciones simultáneas no duplican las piezas.
    const plan = await ensurePlan(tx, ctx.workspace.id, weekStart, ctx.user.id);
    await tx.$queryRaw`SELECT "id" FROM "ContentPlan" WHERE "id" = ${plan.id} FOR UPDATE`;
    const current = await tx.contentPlan.findUniqueOrThrow({ where: { id: plan.id }, select: { strategyStatus: true, strategy: true, focus: true } });
    if (current.strategyStatus !== "PROPOSED" || !current.strategy) throw conflict("strategy_not_proposed");
    const strategy = current.strategy as unknown as StrategyStored;
    const slots = strategy.slots.filter((s) => s.date >= today).slice(0, MAX_SLOTS);
    if (!slots.length) throw conflict("week_past");
    const created: { id: string; key: string }[] = [];
    for (const slot of slots) {
      const item = await createDraftItem(tx, ctx, { format: slot.format, title: slot.title, pillar: slot.pillar, goal: slot.goal, angle: slot.angle, slot: { date: slot.date, time: slot.time }, visualMode: input.visualMode }, ipAddress);
      created.push({ id: item.id, key: slot.key });
      await enqueue(tx, {
        workspaceId: ctx.workspace.id,
        kind: GENERATE_JOB,
        groupKey: groupOf(plan.id),
        createdById: ctx.user.id,
        payload: { itemId: item.id, planId: plan.id, userId: ctx.user.id, instructions: pieceInstructions(current.focus, strategy.summary, slot) },
      });
    }
    await tx.contentPlan.update({ where: { id: plan.id }, data: { strategyStatus: "APPROVED", strategyApprovedAt: new Date(), strategyApprovedById: ctx.user.id } });
    await recordAudit(tx, { workspaceId: ctx.workspace.id, actorUserId: ctx.user.id, action: "plan.strategy_approved", targetType: "plan", targetId: plan.id, metadata: { week: weekStart, pieces: created.length }, ipAddress });
    return { planId: plan.id, items: created };
  });
}

// ─── Tarea en segundo plano: generar una pieza de la estrategia ─────────────

export async function generateJob(job: Job) {
  const { itemId, userId, instructions } = job.payload as { itemId: string; userId: string; instructions: string };
  const ctx = await backgroundContext(job.workspaceId, userId);
  if (!ctx) throw new PermanentJobError("requester_removed");
  const prisma = getPrisma();
  const item = await prisma.contentItem.findFirst({ where: { id: itemId, workspaceId: job.workspaceId }, select: { status: true, format: true } });
  if (!item || item.status === "ARCHIVED") throw new PermanentJobError("item_gone");
  // Reintento después de un corte: si la pieza ya tiene texto de la IA, no se
  // vuelve a pagar otra propuesta.
  const already = await prisma.contentVersion.count({ where: { itemId, author: "AI" } });
  if (!already) {
    try {
      await generatePiece(ctx, itemId, instructions);
    } catch (error) {
      if (error instanceof HttpError && error.status !== 502 && error.status !== 503) throw new PermanentJobError(error.code);
      throw error;
    }
  }
  // Pasa a revisión solo si no tiene nada bloqueante (datos por completar,
  // composiciones que no entran, textos ilegibles…). Si no, queda en borrador.
  const fresh = await prisma.contentItem.findFirstOrThrow({ where: { id: itemId }, select: { status: true, format: true, currentVersion: { select: { content: true } } } });
  const blockers = reviewBlockers(fresh.format, fresh.currentVersion!.content as AnyContent, await brandRules(prisma, job.workspaceId));
  if (fresh.status === "DRAFT" && !blockers.length && ctx.role !== "VIEWER") {
    await submitForReview(ctx, itemId, null);
    return { submitted: true, blockers: 0 };
  }
  return { submitted: false, blockers: blockers.length };
}

// Cuando termina la última tarea de la semana, avisa una sola vez: a quienes
// aprueban (Aprobadores y Dueños), que tienen piezas para revisar; a quien
// aprobó la estrategia, además, lo que quedó para corregir.
export async function onGenerateSettled(job: Job) {
  if (job.kind !== GENERATE_JOB || !job.groupKey) return;
  const prisma = getPrisma();
  const pending = await prisma.job.count({ where: { groupKey: job.groupKey, workspaceId: job.workspaceId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (pending) return;
  const planId = job.groupKey.slice("plan:".length);
  // Un único aviso por estrategia: el proceso que marca la fecha gana.
  const claimed = await prisma.contentPlan.updateMany({ where: { id: planId, workspaceId: job.workspaceId, strategyNotifiedAt: null }, data: { strategyNotifiedAt: new Date() } });
  if (!claimed.count) return;
  const [plan, jobs, workspace] = await Promise.all([
    prisma.contentPlan.findUniqueOrThrow({ where: { id: planId }, select: { weekStart: true, strategyApprovedById: true } }),
    prisma.job.findMany({ where: { groupKey: job.groupKey, workspaceId: job.workspaceId }, select: { status: true, result: true } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: job.workspaceId }, select: { slug: true } }),
  ]);
  const week = plan.weekStart.toISOString().slice(0, 10);
  const submitted = jobs.filter((j) => (j.result as { submitted?: boolean } | null)?.submitted).length;
  const toFix = jobs.length - submitted;
  const href = `/w/${workspace.slug}/calendario?fecha=${week}&plan=${planId}`;
  const parts = [submitted ? `${submitted} ${submitted === 1 ? "pieza está lista" : "piezas están listas"} para revisar y aprobar.` : "", toFix ? `${toFix} ${toFix === 1 ? "necesita" : "necesitan"} correcciones antes de pasar a revisión.` : ""].filter(Boolean);
  await notifyPermission(
    job.workspaceId,
    "content.approve",
    { kind: "strategy.ready", title: `Contenido de la semana del ${week.split("-").reverse().join("/")}`, body: parts.join(" "), href },
    { email: true, also: plan.strategyApprovedById ? [plan.strategyApprovedById] : [] },
  );
}

export const STRATEGY_HANDLERS = { [GENERATE_JOB]: generateJob };
