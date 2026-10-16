import { z } from "zod";

import { FORMAT_LABELS, type Format } from "@/modules/content/formats";

// Reglas de medición (roadmap, etapa 5): se compara a la misma edad (7 días) y
// no se saca ninguna conclusión con menos de 6 publicaciones medidas.
export const MATURE_HOURS = 7 * 24;
export const MIN_MEASURED = 6;
// Para que un grupo (formato o pilar) cuente, al menos 2 publicaciones.
const MIN_GROUP = 2;

export const PERMALINK_RE = /^https:\/\/(www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]{5,40})\/?(\?.*)?$/;

export function shortcodeOf(permalink: string): string | null {
  return permalink.trim().match(PERMALINK_RE)?.[3] ?? null;
}

const count = z.number().int().min(0).max(1_000_000_000).nullable().optional();
export const manualMetricsSchema = z.object({
  capturedAt: z.string().datetime().optional(),
  likes: count,
  comments: count,
  plays: count,
  saves: count,
  shares: count,
  reach: count,
  profileVisits: count,
  inquiries: count,
});
export type ManualMetrics = z.infer<typeof manualMetricsSchema>;

export interface MeasuredPost {
  format: Format;
  pillar: string | null;
  // Última medición a 7 días o más (la más cercana a los 7 días).
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  reach: number | null;
  inquiries: number | null;
}

// Interacciones: lo que se pudo medir de me gusta, comentarios, guardados y compartidos.
export function interactions(p: Pick<MeasuredPost, "likes" | "comments" | "saves" | "shares">): number {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("es-AR") : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }));

// Aprendizajes deterministas a partir de publicaciones medidas a 7 días. Son
// comparaciones de promedios con su cantidad de casos: no se inventa nada y no
// hay conclusiones con pocos datos. Son los que recibe la IA al planificar.
export function computeLearnings(posts: MeasuredPost[]): { lines: string[]; measured: number; enough: boolean } {
  if (posts.length < MIN_MEASURED) return { lines: [], measured: posts.length, enough: false };
  const lines: string[] = [];
  const overall = avg(posts.map(interactions));
  lines.push(`Promedio general: ${fmt(overall)} interacciones por publicación a 7 días (n=${posts.length}).`);

  const groups = <K extends string>(key: (p: MeasuredPost) => K | null) => {
    const map = new Map<K, MeasuredPost[]>();
    for (const p of posts) {
      const k = key(p);
      if (k) map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()].filter(([, ps]) => ps.length >= MIN_GROUP).map(([k, ps]) => ({ key: k, n: ps.length, value: avg(ps.map(interactions)) })).sort((a, b) => b.value - a.value);
  };

  const formats = groups((p) => p.format);
  if (formats.length >= 2) {
    const best = formats[0]!;
    const worst = formats.at(-1)!;
    lines.push(`Formato con más interacciones: ${FORMAT_LABELS[best.key as Format]} (${fmt(best.value)} en promedio, n=${best.n}); el de menos: ${FORMAT_LABELS[worst.key as Format]} (${fmt(worst.value)}, n=${worst.n}).`);
  }
  const pillars = groups((p) => p.pillar);
  if (pillars.length >= 2) {
    lines.push(`Pilar con más interacciones: ${pillars[0]!.key} (${fmt(pillars[0]!.value)}, n=${pillars[0]!.n}); el de menos: ${pillars.at(-1)!.key} (${fmt(pillars.at(-1)!.value)}, n=${pillars.at(-1)!.n}).`);
  }
  const withInquiries = posts.filter((p) => p.inquiries !== null);
  if (withInquiries.length >= MIN_MEASURED) {
    const total = withInquiries.reduce((a, p) => a + (p.inquiries ?? 0), 0);
    const byFormat = new Map<Format, number>();
    for (const p of withInquiries) byFormat.set(p.format, (byFormat.get(p.format) ?? 0) + (p.inquiries ?? 0));
    const top = [...byFormat.entries()].sort((a, b) => b[1] - a[1])[0];
    lines.push(`Consultas comerciales registradas: ${total} en ${withInquiries.length} publicaciones${top && top[1] > 0 ? `; la mayoría llegó desde ${FORMAT_LABELS[top[0]].toLowerCase()}` : ""}.`);
  }
  return { lines, measured: posts.length, enough: true };
}
