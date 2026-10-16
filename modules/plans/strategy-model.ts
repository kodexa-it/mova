import { z } from "zod";

import { addDays, HM_RE, isYmd } from "@/lib/time";
import { FORMAT_LABELS, FORMATS, type Format } from "@/modules/content/formats";
import { brandBlock, type BrandContext } from "@/modules/content/prompts";

// Estrategia semanal: qué se publica cada día de la semana, con qué formato,
// pilar, objetivo y ángulo, y por qué. La propone la IA a partir del foco de la
// semana; la persona la edita y la aprueba. Al aprobarla se crea una pieza por
// fila y se generan en segundo plano.

export const STRATEGY_PROMPT_VERSION = "estrategia-2026-10-16";
export const MIN_SLOTS = 1;
export const MAX_SLOTS = 7;

export const strategySlotSchema = z.object({
  key: z.string().regex(/^[a-z0-9]{6,24}$/),
  date: z.string().refine(isYmd),
  time: z.string().regex(HM_RE),
  format: z.enum(FORMATS),
  pillar: z.string().trim().max(60).nullable(),
  goal: z.string().trim().max(120).nullable(),
  title: z.string().trim().min(1, "Poné un tema.").max(120),
  angle: z.string().trim().max(400),
  rationale: z.string().trim().max(400),
});
export type StrategySlot = z.infer<typeof strategySlotSchema>;

export const strategySchema = z.object({
  summary: z.string().trim().max(800),
  slots: z.array(strategySlotSchema).min(MIN_SLOTS, "La semana necesita al menos una pieza.").max(MAX_SLOTS, "Hasta 7 piezas por semana."),
});
export type Strategy = z.infer<typeof strategySchema>;

export interface StrategyStored extends Strategy {
  promptVersion: string;
}

export interface StrategyInput {
  brand: BrandContext;
  weekStart: string;
  today: string;
  focus: string;
  count: number;
  instructions: string;
  // Piezas que ya tienen fecha en esta semana (no se repiten esos días si se puede).
  scheduled: { date: string; format: Format; title: string }[];
  // Temas de las últimas semanas, para no repetirse.
  recent: { title: string; angle: string; format: Format }[];
  // Aprendizajes de las métricas (vacío si todavía no hay datos suficientes).
  learnings: string[];
}

export const STRATEGY_SYSTEM = [
  "Sos el estratega de contenido de Mova para Instagram. Armás el plan de UNA semana para una marca de Argentina, en español rioplatense.",
  "Reglas:",
  "1. Cada pieza sirve al foco de la semana y a un objetivo de la marca. Un ángulo concreto por pieza, no un tema general.",
  "2. Usá solo los pilares y objetivos de la marca, escritos exactamente igual. Respetá el peso de cada pilar a lo largo de la semana.",
  "3. Variá los formatos según lo que mejor sirva a cada idea (carrusel para enseñar o comparar, Reel para mostrar o contar, Stories para conversar o pedir respuesta, publicación para un mensaje simple).",
  "4. Fechas solo dentro de la semana indicada y desde hoy en adelante. Horario de publicación razonable para el público (HH:MM, 24 h).",
  "5. Nunca inventes cifras, clientes, testimonios ni resultados. Si una idea necesita un dato real que la marca no cargó, planteala sin el dato.",
  "6. Si hay aprendizajes de resultados anteriores, usalos y decí en el porqué cuál aplicaste. Si no hay, no inventes ninguno.",
  "7. rationale: una frase con el porqué de esa pieza ese día.",
  'Respondé solo JSON: {"summary":"","slots":[{"date":"YYYY-MM-DD","time":"HH:MM","format":"CAROUSEL","pillar":"","goal":"","title":"","angle":"","rationale":""}]}',
].join("\n");

export function strategyPrompt(input: StrategyInput): string {
  const days = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i)).filter((d) => d >= input.today);
  return [
    `# Marca\n${brandBlock(input.brand)}`,
    input.brand.pillars.length ? `Pilares (con su peso): ${input.brand.pillars.map((p) => `${p.name} (${p.weight} %)`).join("; ")}.` : "",
    `# Semana\nDel ${input.weekStart} al ${addDays(input.weekStart, 6)}. Hoy es ${input.today}. Días disponibles: ${days.join(", ")}.`,
    `Foco de la semana: ${input.focus}`,
    `Cantidad de piezas: ${input.count}.`,
    `Formatos posibles: ${FORMATS.map((f) => `${f} (${FORMAT_LABELS[f]})`).join(", ")}.`,
    input.scheduled.length ? `Ya tienen fecha esta semana:\n${input.scheduled.map((s) => `- ${s.date}: ${FORMAT_LABELS[s.format]} "${s.title}"`).join("\n")}` : "",
    input.recent.length ? `Temas de las últimas semanas (no los repitas):\n${input.recent.map((r) => `- ${FORMAT_LABELS[r.format]}: ${r.title}${r.angle ? ` (${r.angle})` : ""}`).join("\n")}` : "",
    input.learnings.length ? `# Aprendizajes de resultados anteriores (medidos)\n${input.learnings.map((l) => `- ${l}`).join("\n")}` : "# Aprendizajes\nTodavía no hay resultados medidos suficientes.",
    input.instructions ? `# Indicaciones de la persona\n${input.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const aiSlotSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
  format: z.string(),
  pillar: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  title: z.string(),
  angle: z.string().optional(),
  rationale: z.string().optional(),
});
const aiAnswerSchema = z.object({ summary: z.string().optional(), slots: z.array(aiSlotSchema).max(14) });

// Valida la respuesta de la IA con las reglas fijas: fechas dentro de la semana
// y desde hoy, formatos del catálogo, pilares y objetivos de la marca (si no
// coinciden, quedan vacíos). Lo que no cumple se descarta. Devuelve null si no
// queda ninguna pieza.
export function strategyFromAnswer(
  raw: unknown,
  ctx: { weekStart: string; today: string; count: number; pillars: string[]; goals: string[]; newKey: () => string },
): { strategy: Strategy; dropped: number } | null {
  const parsed = aiAnswerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(ctx.weekStart, i)));
  const match = (value: string | null | undefined, list: string[]) => {
    const v = (value ?? "").trim().toLowerCase();
    return list.find((x) => x.toLowerCase() === v) ?? null;
  };
  let dropped = 0;
  const slots: StrategySlot[] = [];
  for (const s of parsed.data.slots) {
    const date = s.date.trim();
    if (!isYmd(date) || !week.has(date) || date < ctx.today || !(FORMATS as readonly string[]).includes(s.format) || !s.title.trim() || slots.length >= Math.min(ctx.count, MAX_SLOTS)) {
      dropped += 1;
      continue;
    }
    slots.push({
      key: ctx.newKey(),
      date,
      time: s.time && HM_RE.test(s.time) ? s.time : "10:00",
      format: s.format as Format,
      pillar: match(s.pillar, ctx.pillars),
      goal: match(s.goal, ctx.goals),
      title: s.title.trim().slice(0, 120),
      angle: (s.angle ?? "").trim().slice(0, 400),
      rationale: (s.rationale ?? "").trim().slice(0, 400),
    });
  }
  if (!slots.length) return null;
  slots.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return { strategy: { summary: (parsed.data.summary ?? "").trim().slice(0, 800), slots }, dropped };
}

// Indicaciones para generar cada pieza de la estrategia aprobada.
export function pieceInstructions(focus: string, summary: string, slot: StrategySlot): string {
  return [`Foco de la semana: ${focus}`, summary ? `Estrategia de la semana: ${summary}` : "", slot.rationale ? `Por qué esta pieza: ${slot.rationale}` : ""].filter(Boolean).join("\n");
}
