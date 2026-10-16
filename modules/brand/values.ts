import type { SectionInput, SectionKey } from "@/modules/brand/sections";

// Valores iniciales de cada formulario a partir de la marca guardada. Si una
// sección está vacía, propone una fila en blanco para empezar.
// (Tipo estructural para no importar código de servidor en el cliente.)
export interface BrandForForm {
  name: string;
  industry: string;
  description: string;
  website: string | null;
  audienceTimezone: string;
  visual: { palette: unknown; headingFont: string; bodyFont: string; imageStyle: string } | null;
  voice: {
    formality: number;
    humor: number;
    technicality: number;
    enthusiasm: number;
    wordsToUse: string[];
    wordsToAvoid: string[];
    emojiPolicy: "NONE" | "FEW" | "FREE";
    examples: string[];
  } | null;
  offerings: { name: string; description: string }[];
  audiences: { name: string; description: string; painPoints: string[] }[];
  goals: { title: string; kpi: string; target: string }[];
  pillars: { name: string; description: string; weight: number }[];
  proofs: { statement: string; source: string }[];
  rules: { kind: "ALWAYS" | "NEVER"; text: string }[];
}

export type AnySectionInput = SectionInput<SectionKey>;

export function sectionValues(brand: BrandForForm | null, key: SectionKey, workspaceName: string): AnySectionInput {
  switch (key) {
    case "identidad":
      return {
        name: brand?.name ?? workspaceName,
        industry: brand?.industry ?? "",
        description: brand?.description ?? "",
        website: brand?.website ?? "",
        audienceTimezone: brand?.audienceTimezone ?? "America/Argentina/Buenos_Aires",
      };
    case "servicios":
      return { items: brand?.offerings.length ? brand.offerings.map(({ name, description }) => ({ name, description })) : [{ name: "", description: "" }] };
    case "publico":
      return {
        items: brand?.audiences.length
          ? brand.audiences.map(({ name, description, painPoints }) => ({ name, description, painPoints }))
          : [{ name: "", description: "", painPoints: [] }],
      };
    case "objetivos":
      return { items: brand?.goals.length ? brand.goals.map(({ title, kpi, target }) => ({ title, kpi, target })) : [{ title: "", kpi: "", target: "" }] };
    case "voz":
      return brand?.voice
        ? {
            formality: brand.voice.formality,
            humor: brand.voice.humor,
            technicality: brand.voice.technicality,
            enthusiasm: brand.voice.enthusiasm,
            wordsToUse: brand.voice.wordsToUse,
            wordsToAvoid: brand.voice.wordsToAvoid,
            emojiPolicy: brand.voice.emojiPolicy,
            examples: brand.voice.examples,
          }
        : { formality: 3, humor: 2, technicality: 3, enthusiasm: 3, wordsToUse: [], wordsToAvoid: [], emojiPolicy: "FEW", examples: [] };
    case "pilares":
      return {
        items: brand?.pillars.length
          ? brand.pillars.map(({ name, description, weight }) => ({ name, description, weight }))
          : [
              { name: "", description: "", weight: 50 },
              { name: "", description: "", weight: 50 },
            ],
      };
    case "visual": {
      const palette = Array.isArray(brand?.visual?.palette) ? (brand.visual.palette as { name: string; hex: string }[]) : [];
      return {
        palette: palette.length ? palette : [{ name: "Principal", hex: "#1f2023" }],
        headingFont: brand?.visual?.headingFont ?? "",
        bodyFont: brand?.visual?.bodyFont ?? "",
        imageStyle: brand?.visual?.imageStyle ?? "",
      };
    }
    case "datos":
      return { items: brand?.proofs.map(({ statement, source }) => ({ statement, source })) ?? [] };
    case "reglas":
      return { items: brand?.rules.map(({ kind, text }) => ({ kind, text })) ?? [] };
  }
}
