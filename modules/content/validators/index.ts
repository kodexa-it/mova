import { allText, type AnyContent, type Format, type FormatContent } from "@/modules/content/formats";
import { checkDesign, LAYOUT_SPECS, slotsOf, styleOf, type ProofSnapshot } from "@/modules/content/layouts";
import { DENSITY, frameLegibility, MIN_BODY_PT, MIN_TITLE_PT } from "@/modules/content/legibility";
import { framesOf, isBlankFrame, sizeOf } from "@/modules/content/render/frames";
import { brandChecks } from "@/modules/content/validators/brand";
import { captionChecks } from "@/modules/content/validators/caption";
import { hookChecks } from "@/modules/content/validators/hook";
import { humanChecks } from "@/modules/content/validators/human";
import { reelChecks } from "@/modules/content/validators/reel";
import { verdictOf, type Check, type Verdict } from "@/modules/content/validators/report";

export interface ValidationReport {
  version: 1;
  verdict: Verdict;
  checks: Check[];
}

// Corre todos los validadores que aplican al formato. Determinístico: el mismo
// contenido da siempre el mismo reporte, por eso se guarda con la versión.
export function validateContent(format: Format, content: AnyContent, brand: { wordsToAvoid: string[]; proofs?: ProofSnapshot[] }): ValidationReport {
  const checks: Check[] = [];
  const text = allText(format, content);

  checks.push(...brandChecks(text, brand));
  checks.push(...captionChecks(content.caption, content.hashtags));

  switch (format) {
    case "REEL": {
      const c = content as FormatContent<"REEL">;
      checks.push(...hookChecks(c.hooks[c.selectedHook] ?? c.hooks[0] ?? "", "Hook elegido"));
      checks.push(...reelChecks(c.script.map((l) => l.say), c.targetSeconds));
      break;
    }
    case "CAROUSEL": {
      const c = content as FormatContent<"CAROUSEL">;
      const cover = c.slides[0]?.title ?? "";
      checks.push(...hookChecks(cover, "Portada"));
      const coverWords = cover.trim().split(/\s+/).filter(Boolean).length;
      if (coverWords > 8) checks.push({ id: "carousel.cover", label: "Portada", status: "warn", detail: `La portada tiene ${coverWords} palabras: en el feed se lee mejor con 6 o menos.` });
      break;
    }
    case "STORY": {
      const c = content as FormatContent<"STORY">;
      const manual = c.frames.filter((f) => f.sticker !== "NONE").length;
      if (manual)
        checks.push({ id: "story.stickers", label: "Stickers", status: "pass", detail: `${manual} frame(s) con sticker: se agregan a mano al publicar.` });
      break;
    }
    case "FEED_IMAGE":
      checks.push(...hookChecks((content as FormatContent<"FEED_IMAGE">).headline, "Titular"));
      break;
  }
  if (!content.altText.trim()) checks.push({ id: "alt-text", label: "Texto alternativo", status: "warn", detail: "Sin texto alternativo: las personas con lector de pantalla no van a saber qué muestra la imagen." });
  checks.push(...humanChecks(text));
  const layout = layoutChecks(format, content, brand.proofs);
  checks.push(...layout);
  // Si la composición no sirve para el texto, su problema ya está informado.
  const broken = new Set(layout.filter((c) => c.status === "fail").map((c) => Number(c.id.split(".")[1])));
  checks.push(...legibilityChecks(format, content, broken));
  return { version: 1, verdict: verdictOf(checks), checks };
}

const SLOT_NAMES: Record<Format, (i: number) => string> = {
  CAROUSEL: (i) => (i === 0 ? "Portada" : `Slide ${i + 1}`),
  FEED_IMAGE: () => "Imagen",
  STORY: (i) => `Frame ${i + 1}`,
  REEL: () => "Portada del Reel",
};

// Cada composición elegida tiene que servir para su texto: si no entra, la
// pieza no se puede aprobar (el render la cortaría o quedaría vacía).
function layoutChecks(format: Format, content: AnyContent, proofs: ProofSnapshot[] | undefined): Check[] {
  const refs = slotsOf(format, content as unknown as Record<string, unknown>).filter((r) => r.design && r.design.layout !== "classic");
  if (!refs.length) return [];
  const problems = refs
    .map((r) => ({ r, reason: checkDesign(r.slot, r.design, { proofs }) }))
    .filter((p): p is { r: (typeof refs)[number]; reason: string } => p.reason !== null);
  if (!problems.length) return [{ id: "layout", label: "Composición", status: "pass", detail: "Cada composición elegida entra con su texto." }];
  return problems.map(({ r, reason }) => ({
    id: `layout.${r.index}`,
    label: "Composición",
    status: "fail" as const,
    detail: `${SLOT_NAMES[format](r.index)} (${LAYOUT_SPECS[r.design!.layout].label}): ${reason}`,
  }));
}

// Legibilidad en el teléfono (V1c): el texto entra en su composición, ningún
// texto queda por debajo del tamaño mínimo y cada imagen tiene una cantidad de
// palabras que se puede leer al deslizar. Lo que no entra o no se lee bloquea
// el envío a revisión y la aprobación.
function legibilityChecks(format: Format, content: AnyContent, skip: Set<number>): Check[] {
  const style = styleOf(content as unknown as Record<string, unknown>);
  const checks: Check[] = [];
  framesOf(format, content).forEach((frame, i) => {
    // Un diseño propio ya es la imagen final: su texto no lo dibuja Mova.
    if (skip.has(i) || isBlankFrame(frame) || frame.design?.layout === "upload") return;
    const name = SLOT_NAMES[format](i);
    const result = frameLegibility(frame, style);
    const limits = sizeOf(frame).height > 1500 ? DENSITY.vertical : DENSITY.portrait;
    if (!result.fits) {
      checks.push({ id: `legibility.fit.${i}`, label: "Legibilidad", status: "fail", detail: `${name}: el texto no entra (ocupa cerca del ${Math.round(result.usage * 100)} % del espacio). Acortalo o elegí otra composición.` });
    } else if (result.usage > 0.92) {
      checks.push({ id: `legibility.fit.${i}`, label: "Legibilidad", status: "warn", detail: `${name}: el texto llena casi todo el espacio. Revisalo en la vista previa.` });
    }
    if (result.tooSmall) {
      const min = result.tooSmall.kind === "title" ? MIN_TITLE_PT : MIN_BODY_PT;
      checks.push({ id: `legibility.size.${i}`, label: "Legibilidad", status: "fail", detail: `${name}: un texto se vería a ${result.smallestPt.toFixed(1)} pt en el teléfono (mínimo ${min}). Acortalo para que se dibuje más grande.` });
    }
    if (result.words > limits.fail) {
      checks.push({ id: `legibility.density.${i}`, label: "Densidad", status: "fail", detail: `${name}: ${result.words} palabras. Para leerse al deslizar, hasta ${limits.fail} (ideal ${limits.warn} o menos).` });
    } else if (result.words > limits.warn) {
      checks.push({ id: `legibility.density.${i}`, label: "Densidad", status: "warn", detail: `${name}: ${result.words} palabras. Se lee mejor con ${limits.warn} o menos.` });
    }
  });
  if (format === "STORY" && slotsOf(format, content as unknown as Record<string, unknown>).some((r) => !r.design || r.design.layout === "classic")) {
    checks.push({ id: "legibility.safe-zone", label: "Zonas seguras", status: "warn", detail: "Los frames clásicos dejan menos margen abajo: revisá que la marca no quede bajo la barra de respuesta. Las composiciones respetan las zonas seguras de Instagram." });
  }
  if (!checks.some((c) => c.status === "fail" || c.id.startsWith("legibility.fit") || c.id.startsWith("legibility.size") || c.id.startsWith("legibility.density"))) {
    checks.unshift({ id: "legibility", label: "Legibilidad", status: "pass", detail: "Todo el texto entra y se lee en el teléfono." });
  }
  return checks;
}
