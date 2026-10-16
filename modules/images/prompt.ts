import { createHash } from "node:crypto";

import type { ArtLayoutId, SlotRole } from "@/modules/content/layouts";
import type { AspectRatio, ImageSize } from "@/modules/images/pricing";

// Pedido al modelo de imágenes. Lo arma el servidor a partir de la marca y del
// texto de la imagen; la persona solo puede sumar una dirección corta. Reglas
// fijas: sin texto en la imagen (lo dibuja Mova), sin logos ni marcas, sin
// personas reales, sin capturas de proyectos ni resultados inventados.
export const ART_PROMPT_VERSION = "imagen-2026-10-15";

export interface ArtBrand {
  industry: string;
  description: string;
  imageStyle: string;
  palette: { name: string; hex: string }[];
  audiences: string[];
}

export interface ArtRequestInput {
  brand: ArtBrand;
  slot: { role: SlotRole; title: string; body: string };
  layout: ArtLayoutId;
  aspectRatio: AspectRatio;
  brief: string;
}

const RULES = [
  "ABSOLUTE RULES:",
  "- No text of any kind: no letters, words, numbers, captions, labels, signage, watermarks or logos anywhere in the image.",
  "- No real brands, trademarks, products or recognizable people. No celebrities.",
  "- Do not depict real client work, website or app screenshots, dashboards with data, charts with numbers, awards, testimonials or results. If screens or devices appear, show them blank or with abstract shapes only.",
  "- Conceptual, original imagery: it must read as an illustration or concept, never as a photo of a real project or a real event.",
];

function composition(layout: ArtLayoutId, role: SlotRole, aspect: AspectRatio) {
  const frame = aspect === "9:16" ? "vertical 9:16 frame" : "portrait 4:5 frame";
  if (layout === "art-cover") {
    const safe = aspect === "9:16" ? " Keep the top 15% and bottom 20% free of important details." : "";
    return `Full-bleed background for a ${frame}. Main subject in the upper half; the lower 45% must be calm, darker and low-detail so a headline can be overlaid in white.${safe}`;
  }
  return `Image for a rounded panel inside a ${frame} slide (${role === "last" ? "closing slide" : "content slide"}). One clear focal subject, centered, generous negative space, no busy edges.`;
}

export function buildArtPrompt(input: ArtRequestInput): string {
  const { brand, slot } = input;
  const colors = brand.palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex)).slice(0, 5);
  const topic = [slot.title.trim(), slot.body.trim()].filter(Boolean).join(" — ");
  return [
    "Create an original image for an Instagram post.",
    composition(input.layout, slot.role, input.aspectRatio),
    `Business context: ${[brand.industry, brand.description].filter((s) => s.trim()).join(". ").slice(0, 400) || "small business"}.`,
    brand.audiences.length ? `Audience: ${brand.audiences.slice(0, 3).join(", ")}.` : "",
    `Topic of this image (Spanish, for meaning only — never write it in the image): ${JSON.stringify(topic.slice(0, 300))}.`,
    colors.length ? `Color palette to follow: ${colors.map((c) => `${c.name || "color"} ${c.hex}`).join(", ")}. Use them as dominant tones and accents.` : "",
    brand.imageStyle.trim() ? `Brand image style: ${brand.imageStyle.trim().slice(0, 300)}.` : "Style: modern, minimal, premium, clean lighting, soft depth.",
    input.brief.trim() ? `Art direction from the team: ${input.brief.trim().slice(0, 300)}.` : "",
    ...RULES,
  ]
    .filter(Boolean)
    .join("\n");
}

// Mismo pedido, mismo modelo y misma medida → misma huella. Sirve para ofrecer
// reutilizar una imagen ya generada (sin costo) en lugar de pagar otra igual.
export function promptHash(model: string, aspectRatio: AspectRatio, imageSize: ImageSize, prompt: string): string {
  return createHash("sha256").update(`${ART_PROMPT_VERSION}\n${model}\n${aspectRatio}\n${imageSize}\n${prompt}`).digest("hex");
}

// Ancho y alto de un PNG, JPEG o WebP leyendo su encabezado (sin dependencias).
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      const length = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
      i += 2 + length;
    }
    return null;
  }
  if (bytes.length > 30 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (kind === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
  }
  return null;
}
