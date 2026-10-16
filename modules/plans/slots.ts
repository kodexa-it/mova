import "server-only";

import type { Prisma } from "@prisma/client";

import { DEFAULT_TIMEZONE, weekStartOf, zonedToUtc } from "@/lib/time";

type Tx = Prisma.TransactionClient;

export interface Slot {
  date: string;
  time: string;
}

// Zona horaria del calendario: la del público de la marca.
export async function calendarZone(db: Pick<Tx, "brand">, workspaceId: string): Promise<string> {
  const brand = await db.brand.findUnique({ where: { workspaceId }, select: { audienceTimezone: true } });
  return brand?.audienceTimezone ?? DEFAULT_TIMEZONE;
}

export const weekDate = (weekStart: string) => new Date(`${weekStart}T00:00:00.000Z`);
export const ymdOfDbDate = (date: Date) => date.toISOString().slice(0, 10);

// Devuelve el plan de la semana y lo crea si no existe. Dos pedidos simultáneos
// no crean dos planes: la base tiene un único por workspace y semana.
export async function ensurePlan(tx: Tx, workspaceId: string, weekStart: string, createdById: string | null) {
  const where = { workspaceId_weekStart: { workspaceId, weekStart: weekDate(weekStart) } };
  const existing = await tx.contentPlan.findUnique({ where, select: { id: true } });
  if (existing) return existing;
  const brand = await tx.brand.findUnique({ where: { workspaceId }, select: { id: true } });
  await tx.contentPlan.createMany({
    data: [{ workspaceId, brandId: brand?.id ?? null, weekStart: weekDate(weekStart), createdById }],
    skipDuplicates: true,
  });
  return tx.contentPlan.findUniqueOrThrow({ where, select: { id: true } });
}

// Fecha de la pieza en UTC y el plan de su semana (o ninguno, sin fecha).
export async function resolveSlot(tx: Tx, workspaceId: string, slot: Slot | null, userId: string) {
  if (!slot) return { scheduledFor: null, planId: null };
  const zone = await calendarZone(tx, workspaceId);
  const plan = await ensurePlan(tx, workspaceId, weekStartOf(slot.date), userId);
  return { scheduledFor: zonedToUtc(slot.date, slot.time, zone), planId: plan.id };
}
