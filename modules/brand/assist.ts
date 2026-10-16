import "server-only";

import { conflict, HttpError } from "@/lib/http";
import { requirePermission, type WorkspaceContext } from "@/modules/access/context";
import { markCallOutputInvalid, runAi } from "@/modules/ai/gateway";
import { extractJson } from "@/modules/ai/json";
import { sectionStatus } from "@/modules/brand/completeness";
import { DIALS, SECTIONS, type SectionInput } from "@/modules/brand/sections";
import { getBrand, shapeOf, type BrandProfile } from "@/modules/brand/service";

// Secciones en las que la IA puede proponer. Identidad y visual son decisiones
// de la marca, y los datos publicables tienen que ser reales: la IA nunca los
// propone.
export const ASSISTABLE = ["servicios", "publico", "objetivos", "voz", "pilares", "reglas"] as const;
export type AssistableSection = (typeof ASSISTABLE)[number];

export function isAssistable(section: string): section is AssistableSection {
  return (ASSISTABLE as readonly string[]).includes(section);
}

const SHAPES: Record<AssistableSection, string> = {
  servicios: '{"items":[{"name":"...","description":"..."}]}  (1 a 6 servicios)',
  publico: '{"items":[{"name":"...","description":"...","painPoints":["...","..."]}]}  (1 a 3 públicos, hasta 4 preocupaciones cada uno)',
  objetivos: '{"items":[{"title":"...","kpi":"cómo se mide","target":""}]}  (1 a 3 objetivos; target vacío salvo que el contexto dé una cifra)',
  voz: '{"formality":1-5,"humor":1-5,"technicality":1-5,"enthusiasm":1-5,"wordsToUse":["..."],"wordsToAvoid":["..."],"emojiPolicy":"NONE"|"FEW"|"FREE","examples":[]}',
  pilares: '{"items":[{"name":"...","description":"...","weight":número}]}  (3 a 5 pilares, pesos enteros múltiplos de 5 que suman exactamente 100)',
  reglas: '{"items":[{"kind":"ALWAYS"|"NEVER","text":"..."}]}  (3 a 6 reglas)',
};

function context(brand: BrandProfile): string {
  const lines = [
    `Marca: ${brand.name}`,
    `Rubro: ${brand.industry}`,
    `Qué hace: ${brand.description}`,
    brand.website ? `Sitio: ${brand.website}` : null,
    brand.offerings.length ? `Servicios: ${brand.offerings.map((o) => o.name).join("; ")}` : null,
    brand.audiences.length ? `Públicos: ${brand.audiences.map((a) => a.name).join("; ")}` : null,
    brand.goals.length ? `Objetivos: ${brand.goals.map((g) => g.title).join("; ")}` : null,
    brand.voice ? `Voz: ${DIALS.map((d) => `${d.label} ${brand.voice![d.key]}/5`).join(", ")}` : null,
    brand.pillars.length ? `Pilares: ${brand.pillars.map((p) => `${p.name} ${p.weight}%`).join("; ")}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

const SYSTEM = [
  "Sos el asistente de marca de Mova, una plataforma de comunicación para empresas de Argentina.",
  "Tu tarea es proponer el contenido de una sección del perfil de marca, para que una persona lo revise y decida.",
  "Escribí en español rioplatense, claro y concreto, sin frases de relleno.",
  "No inventes cifras, clientes, premios, testimonios ni datos que no estén en el contexto.",
  "Respondé solo con un objeto JSON válido, sin texto antes ni después.",
].join("\n");

export async function assistBrandSection<K extends AssistableSection>(
  ctx: WorkspaceContext,
  section: K,
  notes: string,
): Promise<SectionInput<K>> {
  requirePermission(ctx, "brand.update");
  const brand = await getBrand(ctx);
  if (!brand || sectionStatus(shapeOf(brand), "identidad") !== "complete") throw conflict("brand_identity_required");

  const prompt = [
    `Contexto de la marca:\n${context(brand)}`,
    `Sección a proponer: ${SECTIONS[section].title} (${SECTIONS[section].summary})`,
    notes ? `Indicaciones de la persona: ${notes}` : null,
    `Forma exacta de la respuesta: ${SHAPES[section]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, callId } = await runAi(ctx, {
    operation: `brand.assist.${section}`,
    tier: "fast",
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1500,
  });

  const parsed = SECTIONS[section].schema.safeParse(extractJson(text));
  if (!parsed.success) {
    await markCallOutputInvalid(callId);
    throw new HttpError(502, "ai_invalid_output");
  }
  return parsed.data as SectionInput<K>;
}
