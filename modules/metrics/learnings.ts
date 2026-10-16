import "server-only";

import type { Format } from "@/modules/content/formats";
import { getPrisma } from "@/lib/prisma";
import { computeLearnings, MATURE_HOURS, type MeasuredPost } from "@/modules/metrics/model";

// Publicaciones del workspace medidas a 7 días o más, con la medición más
// cercana a los 7 días de cada fuente combinada (lo público de Apify y lo
// privado cargado a mano).
export async function measuredPosts(workspaceId: string): Promise<MeasuredPost[]> {
  const pubs = await getPrisma().publication.findMany({
    where: { workspaceId },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: { item: { select: { format: true, pillar: true } }, snapshots: { where: { ageHours: { gte: MATURE_HOURS } }, orderBy: { ageHours: "asc" }, select: { source: true, likes: true, comments: true, saves: true, shares: true, reach: true, inquiries: true } } },
  });
  return pubs
    .filter((p) => p.snapshots.length)
    .map((p) => {
      const pick = <K extends "likes" | "comments" | "saves" | "shares" | "reach" | "inquiries">(k: K) => p.snapshots.find((s) => s[k] !== null)?.[k] ?? null;
      return { format: p.item.format as Format, pillar: p.item.pillar, likes: pick("likes"), comments: pick("comments"), saves: pick("saves"), shares: pick("shares"), reach: pick("reach"), inquiries: pick("inquiries") };
    });
}

// Líneas que recibe la IA al proponer la estrategia semanal. Vacío si todavía
// no hay al menos 6 publicaciones medidas a 7 días.
export async function learningsFor(workspaceId: string): Promise<string[]> {
  return computeLearnings(await measuredPosts(workspaceId)).lines;
}
