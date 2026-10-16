import "server-only";

import type { ContentStatus, Prisma } from "@prisma/client";

import { badRequest, conflict, notFound } from "@/lib/http";
import { getPrisma } from "@/lib/prisma";
import { weekStartOf, zonedHm, zonedRange, zonedYmd } from "@/lib/time";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { recordAudit } from "@/modules/audit/service";
import type { CalendarQuery } from "@/modules/plans/schemas";
import { calendarZone, ensurePlan, resolveSlot, weekDate, ymdOfDbDate, type Slot } from "@/modules/plans/slots";

// Hasta 6 semanas: lo que muestra la vista mensual.
const MAX_RANGE_DAYS = 42;

// Estados en los que la fecha ya no se puede cambiar desde el calendario: lo
// publicado conserva la fecha real de su registro de publicación.
const FIXED: ContentStatus[] = ["PUBLISHING", "PUBLISHED", "ARCHIVED"];

const calendarSelect = {
  id: true,
  title: true,
  format: true,
  status: true,
  pillar: true,
  goal: true,
  scheduledFor: true,
  currentVersion: { select: { number: true, verdict: true } },
} satisfies Prisma.ContentItemSelect;

export async function getCalendarZone(ctx: WorkspaceContext): Promise<string> {
  requirePermission(ctx, "workspace.read");
  return calendarZone(getPrisma(), ctx.workspace.id);
}

export async function getCalendar(ctx: WorkspaceContext, query: CalendarQuery) {
  requirePermission(ctx, "workspace.read");
  const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000;
  if (days <= 0 || days > MAX_RANGE_DAYS) throw badRequest("invalid_range");
  const prisma = getPrisma();
  const timezone = await calendarZone(prisma, ctx.workspace.id);

  const where: Prisma.ContentItemWhereInput = {
    workspaceId: ctx.workspace.id,
    scheduledFor: zonedRange(query.from, query.to, timezone),
    status: !query.status || query.status === "ACTIVE" ? { not: "ARCHIVED" } : query.status,
  };
  if (query.format) where.format = query.format;
  if (query.pillar) where.pillar = query.pillar;

  const [items, plans] = await Promise.all([
    prisma.contentItem.findMany({ where, orderBy: { scheduledFor: "asc" }, select: calendarSelect, take: 500 }),
    prisma.contentPlan.findMany({
      where: { workspaceId: ctx.workspace.id, weekStart: { gte: weekDate(weekStartOf(query.from)), lt: weekDate(query.to) } },
      select: { id: true, weekStart: true, focus: true, source: true },
    }),
  ]);

  return {
    timezone,
    items: items.map((item) => ({
      ...item,
      date: zonedYmd(item.scheduledFor!, timezone),
      time: zonedHm(item.scheduledFor!, timezone),
    })),
    plans: plans.map((plan) => ({ ...plan, weekStart: ymdOfDbDate(plan.weekStart) })),
  };
}

export type CalendarItem = Awaited<ReturnType<typeof getCalendar>>["items"][number];

// Piezas activas sin fecha: la bandeja desde la que se arma la semana.
export async function listUnscheduled(ctx: WorkspaceContext) {
  requirePermission(ctx, "workspace.read");
  return getPrisma().contentItem.findMany({
    where: { workspaceId: ctx.workspace.id, scheduledFor: null, status: { notIn: FIXED } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, format: true, status: true, pillar: true },
    take: 50,
  });
}

export async function savePlanFocus(ctx: WorkspaceContext, weekStart: string, focus: string, ipAddress: string | null) {
  requirePermission(ctx, "plan.write");
  return getPrisma().$transaction(async (tx) => {
    const plan = await ensurePlan(tx, ctx.workspace.id, weekStart, ctx.user.id);
    const updated = await tx.contentPlan.update({ where: { id: plan.id }, data: { focus }, select: { id: true, focus: true } });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "plan.updated",
      targetType: "plan",
      targetId: plan.id,
      metadata: { week: weekStart },
      ipAddress,
    });
    return { ...updated, weekStart };
  });
}

// Pone, cambia o quita la fecha prevista de una pieza. La pieza pasa al plan de
// la semana de esa fecha.
export async function scheduleContent(ctx: WorkspaceContext, itemId: string, slot: Slot | null, ipAddress: string | null) {
  requirePermission(ctx, "plan.write");
  return getPrisma().$transaction(async (tx) => {
    const item = await tx.contentItem.findFirst({
      where: { id: itemId, workspaceId: ctx.workspace.id },
      select: { status: true, title: true, scheduledFor: true },
    });
    if (!item) throw notFound();
    if (FIXED.includes(item.status)) throw conflict("schedule_locked");

    const next = await resolveSlot(tx, ctx.workspace.id, slot, ctx.user.id);
    if ((item.scheduledFor?.getTime() ?? null) === (next.scheduledFor?.getTime() ?? null)) return { scheduledFor: item.scheduledFor, changed: false };

    await tx.contentItem.update({ where: { id: itemId }, data: next });
    await recordAudit(tx, {
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      action: "content.scheduled",
      targetType: "content",
      targetId: itemId,
      metadata: { title: item.title, to: slot ? `${slot.date} ${slot.time}` : null },
      ipAddress,
    });
    return { scheduledFor: next.scheduledFor, changed: true };
  });
}
