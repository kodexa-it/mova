import { SECTION_KEYS, SECTIONS, type SectionKey } from "@/modules/brand/sections";

// Perfil mínimo para calcular el avance. Se arma desde la base o desde un
// borrador; es una función pura para poder probarla sin base de datos.
export interface BrandShape {
  name: string;
  industry: string;
  description: string;
  hasVoice: boolean;
  paletteCount: number;
  offerings: number;
  audiences: number;
  goals: number;
  pillarWeights: number[];
  proofs: number;
  rules: number;
}

export type SectionStatus = "complete" | "incomplete" | "optional";

export function sectionStatus(brand: BrandShape | null, key: SectionKey): SectionStatus {
  if (!brand) return SECTIONS[key].required ? "incomplete" : "optional";
  const done: Record<SectionKey, boolean> = {
    identidad: Boolean(brand.name.trim() && brand.industry.trim() && brand.description.trim().length >= 20),
    servicios: brand.offerings > 0,
    publico: brand.audiences > 0,
    objetivos: brand.goals > 0,
    voz: brand.hasVoice,
    pilares: brand.pillarWeights.length >= 2 && brand.pillarWeights.reduce((a, b) => a + b, 0) === 100,
    visual: brand.paletteCount > 0,
    datos: brand.proofs > 0,
    reglas: brand.rules > 0,
  };
  if (done[key]) return "complete";
  return SECTIONS[key].required ? "incomplete" : "optional";
}

export function brandProgress(brand: BrandShape | null) {
  const required = SECTION_KEYS.filter((key) => SECTIONS[key].required);
  const completed = required.filter((key) => sectionStatus(brand, key) === "complete");
  return {
    completed: completed.length,
    total: required.length,
    isComplete: completed.length === required.length,
    nextIncomplete: required.find((key) => sectionStatus(brand, key) !== "complete") ?? null,
  };
}
