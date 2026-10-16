import { createHash } from "node:crypto";

import type { Format } from "@/modules/content/formats";
import { artRefsOf, domainOf, styleOf, usedLayouts, type LayoutId } from "@/modules/content/layouts";
import type { PaletteColor } from "@/modules/content/render/theme";

// Versión de las plantillas clásicas y de las tipografías. Cambiarla cuando
// cambie cómo se ve cualquier imagen: todas las aprobaciones anteriores quedan
// sin efecto, porque sus imágenes ya no se pueden reproducir exactamente. Un
// test con huellas fijas (render.golden.test.ts) avisa si cambian sin querer.
export const RENDER_VERSION = "plantillas-2026-10-15";

// Versión de cada composición del catálogo. Cambiar una solo afecta a las
// piezas aprobadas que la usan (vuelven a revisión por "plantillas").
export const LAYOUT_VERSIONS: Record<Exclude<LayoutId, "classic">, number> = {
  "cover-editorial": 1,
  "cover-device": 1,
  steps: 1,
  "icon-list": 1,
  compare: 1,
  // 2: en Stories ya no dibujan barras de progreso (las pone Instagram).
  quote: 2,
  stat: 2,
  browser: 1,
  phone: 1,
  cta: 1,
  "art-cover": 1,
  "art-panel": 1,
  upload: 1,
};

// Versión de los recursos del estilo de pieza (patrones y la tipografía serif
// del preset editorial). Solo cuenta en las piezas que usan un estilo.
export const STYLE_VERSION = 1;
// Versión de las plantillas del estilo Impacto (impact-templates.tsx).
export const IMPACT_VERSION = 1;

// Composiciones que muestran el sitio de la marca.
const SHOWS_WEBSITE = new Set<LayoutId>(["cover-device", "browser", "cta"]);

export interface VisualContext {
  brandName: string;
  palette: PaletteColor[];
  website?: string | null;
  // No define la apariencia: solo dónde buscar las imágenes generadas.
  workspaceId?: string;
}

// Lo que define la apariencia de las imágenes, además del contenido. El nombre
// de cada color no se dibuja, así que no cuenta.
export function visualSnapshot(visual: VisualContext) {
  return { renderVersion: RENDER_VERSION, brandName: visual.brandName, palette: visual.palette.map((c) => c.hex.toLowerCase()) };
}

export function visualHash(visual: VisualContext): string {
  return createHash("sha256").update(JSON.stringify(visualSnapshot(visual))).digest("hex");
}

// Lo que define la apariencia de una pieza concreta: lo común más las
// composiciones que usa (con su versión) y el sitio de la marca si se dibuja.
// Sin composiciones es exactamente visualSnapshot: las aprobaciones de piezas
// clásicas no cambian. Con imágenes generadas, incluye la huella de cada una
// (por posición): la aprobación queda atada a esos archivos exactos.
export function pieceVisualSnapshot(format: Format, content: unknown, visual: VisualContext) {
  const base = visualSnapshot(visual);
  const record = content as Record<string, unknown>;
  const layouts = usedLayouts(format, record) as Exclude<LayoutId, "classic">[];
  const style = styleOf(record);
  // El estilo Impacto cambia también las imágenes clásicas.
  if (!layouts.length && style?.preset !== "impacto") return base;
  const art = artRefsOf(format, record);
  return {
    ...base,
    layouts: Object.fromEntries(layouts.map((l) => [l, LAYOUT_VERSIONS[l]])),
    ...(layouts.some((l) => SHOWS_WEBSITE.has(l)) || style?.preset === "impacto" ? { website: domainOf(visual.website) } : {}),
    ...(style ? { style: { ...style, version: style.preset === "impacto" ? `${STYLE_VERSION}.${IMPACT_VERSION}` : STYLE_VERSION } } : {}),
    ...(art.length ? { art: art.map((a) => ({ index: a.index, assetId: a.art.assetId, sha256: a.art.sha256 })) } : {}),
  };
}

export function pieceVisualHash(format: Format, content: unknown, visual: VisualContext): string {
  return createHash("sha256").update(JSON.stringify(pieceVisualSnapshot(format, content, visual))).digest("hex");
}

export function bytesHash(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).digest("hex");
}
