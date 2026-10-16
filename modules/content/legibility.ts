import { lines, type PieceStyle } from "@/modules/content/layouts";
import { sizeOf, type PlacedFrame } from "@/modules/content/render/frames";
import { impactTitleSize } from "@/modules/content/render/impact-sizes";
import { titleSize } from "@/modules/content/render/sizes";

// Legibilidad en el teléfono (V1c). Determinístico y sin renderizar: estima el
// alto de cada bloque de texto con los mismos tamaños que usan las plantillas
// y lo compara con el espacio que la composición le deja. Las cuentas son
// aproximadas (ancho medio de carácter por tipografía), así que el margen es
// conservador: solo falla lo que claramente no entra o no se lee.

// Una imagen de 1080 px se ve en el feed a unos 390 pt de ancho.
export const PHONE_SCALE = 390 / 1080;
// Tamaños mínimos en el teléfono (pt): texto 11, títulos 14.
export const MIN_BODY_PT = 11;
export const MIN_TITLE_PT = 14;
// Palabras por imagen: más que esto no se lee mientras se desliza.
export const DENSITY = { portrait: { warn: 35, fail: 45 }, vertical: { warn: 28, fail: 40 } } as const;

const INNER = 1080 - 96 * 2;

// Ancho medio de un carácter en "em" (medido sobre texto en español).
const CHAR_EM = { title: 0.5, body: 0.47, serif: 0.42, display: 0.46 } as const;

export interface TextBlock {
  text: string;
  size: number;
  lineHeight: number;
  width: number;
  kind: "title" | "body";
  serif?: boolean;
  // Tipografía condensada en mayúsculas (estilo Impacto).
  display?: boolean;
}

export interface FrameMetrics {
  blocks: TextBlock[];
  // Alto disponible para esos bloques (sin márgenes, encabezado, pie ni ilustraciones).
  available: number;
}

export function estimateLines(block: TextBlock): number {
  const em = block.display ? CHAR_EM.display : block.serif ? CHAR_EM.serif : CHAR_EM[block.kind];
  const perLine = Math.max(1, Math.floor(block.width / (block.size * em)));
  return block.text.split("\n").reduce((total, paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return total;
    let count = 1;
    let used = 0;
    for (const word of words) {
      const len = word.length;
      if (used === 0) used = len;
      else if (used + 1 + len <= perLine) used += 1 + len;
      else {
        count += 1 + Math.floor(Math.max(0, len - 1) / perLine);
        used = len % perLine || perLine;
      }
    }
    return total + count;
  }, 0);
}

export function blockHeight(block: TextBlock): number {
  return estimateLines(block) * block.size * block.lineHeight;
}

// Bloques de texto y espacio disponible de una imagen, según su composición.
// Refleja templates.tsx y layout-templates.tsx: si cambian los tamaños allá,
// cambiarlos acá (legibility.test.ts compara los casos límite).
export function frameMetrics(frame: PlacedFrame, style?: PieceStyle): FrameMetrics {
  if (frame.design?.layout === "upload") return { blocks: [], available: 1 };
  if (style?.preset === "impacto") return impactMetrics(frame);
  const { height } = sizeOf(frame);
  const vertical = height > 1500;
  const serif = style?.preset === "editorial";
  const layout = frame.design?.layout ?? "classic";
  const { title, body } = frame.slot;
  const T = (text: string, base: number, width = INNER, lh = 1.04): TextBlock => ({ text, size: titleSize(text, base), lineHeight: lh, width, kind: "title", serif: serif && layout !== "classic" });
  const B = (text: string, size: number, width = INNER, lh = 1.35): TextBlock => ({ text, size, lineHeight: lh, width, kind: "body" });
  const safe = vertical ? 250 + 360 : 192;
  const area = height - safe;
  const chrome = 100; // encabezado y pie con sus separaciones
  const present = (b: TextBlock) => b.text.trim().length > 0;

  let blocks: TextBlock[] = [];
  let available = area - chrome;
  switch (layout) {
    case "classic":
      switch (frame.kind) {
        case "cover":
          return { blocks: [T(frame.title, 120, INNER, 1.02)], available: 1350 - 192 - 160 };
        case "slide":
          return { blocks: [T(frame.title, 84, INNER, 1.06), B(frame.body, 42)].filter(present), available: 1350 - 192 - 120 - 100 - 36 };
        case "image":
          return { blocks: [T(frame.headline, 112, INNER, 1.03), B(frame.subline, 44, INNER, 1.3)].filter(present), available: 1350 - 192 - 100 - 36 };
        case "story":
          return { blocks: [T(frame.text, 88, INNER, 1.12)], available: 1920 - 440 - 100 - (frame.sticker ? 260 : 0) };
        case "reel-cover":
          return { blocks: [T(frame.text, 128, INNER, 1.02)], available: 1920 - 520 - 60 };
      }
      break;
    case "cover-editorial":
      blocks = [T(title, vertical ? 140 : 132)];
      available -= 56;
      break;
    case "cover-device": {
      const device = frame.design?.device === "phone" ? (vertical ? 900 : 640) : frame.design?.device === "laptop" ? Math.round(INNER * 0.86 * 0.62) + 30 : vertical ? 760 : 600;
      blocks = [T(title, vertical ? 112 : 100)];
      available -= device + 40;
      break;
    }
    case "steps":
    case "icon-list": {
      const items = lines(body);
      const size = items.length > 4 ? 38 : 42;
      const textW = INNER - (layout === "steps" ? 76 : 84) - 30;
      blocks = [...(title.trim() ? [T(title, 76)] : []), ...items.map((l) => B(l, size, textW, 1.3))];
      available -= 56 + (items.length - 1) * (items.length > 4 ? 26 : 34);
      break;
    }
    case "compare": {
      const items = lines(body);
      blocks = [...(title.trim() ? [T(title, 76)] : []), ...items.map((l) => B(l, 42, INNER - 88 - 72 - 30, 1.3))];
      available -= 40 * 2 + 80 * items.length;
      break;
    }
    case "quote": {
      const text = body.trim() || title.trim();
      const size = text.length <= 70 ? 84 : text.length <= 120 ? 72 : 62;
      blocks = [{ text, size, lineHeight: 1.16, width: INNER, kind: "title", serif }];
      available -= 150 + 32 * 1.3 + (body.trim() && title.trim() ? 32 * 1.3 : 0) + 28 * 3;
      break;
    }
    case "stat": {
      const statement = frame.design?.proof?.statement ?? "";
      blocks = [B(statement, 46, INNER, 1.28)];
      available -= 300 + 10 + 36 * 3 + (title.trim() && frame.kind !== "story" ? 52 : 0);
      break;
    }
    case "browser":
    case "art-panel":
      blocks = [T(title, 72), B(body, 38)].filter(present);
      available -= (body.trim() ? 560 : 680) + 36 * 2 + 22;
      break;
    case "phone":
      blocks = [T(title, 68, INNER - 48 - 360), B(body, 36, INNER - 48 - 360)].filter(present);
      available = Math.min(available, 720 + 120) - 26;
      break;
    case "cta":
      blocks = [T(title, 112), B(body, 42)].filter(present);
      available -= 96 + 40 * 2;
      break;
    case "art-cover": {
      // El texto va sobre el velo de la mitad inferior.
      const main = title.trim() || body.trim();
      const sub = title.trim() ? body.trim() : "";
      blocks = [T(main, vertical ? 128 : 120), B(sub, 40)].filter(present);
      available = Math.round(area * 0.6) - 12 - 32 * 2 - (frame.kind === "cover" ? 40 : 0) - (frame.kind === "story" || frame.kind === "image" ? 40 : 0);
      break;
    }
  }
  return { blocks, available };
}

export interface FrameLegibility {
  fits: boolean;
  usage: number; // proporción del espacio que ocupa el texto (1 = justo)
  smallestPt: number;
  tooSmall: TextBlock | null;
  words: number;
}

export function frameLegibility(frame: PlacedFrame, style?: PieceStyle): FrameLegibility {
  const { blocks, available } = frameMetrics(frame, style);
  const used = blocks.reduce((total, b) => total + blockHeight(b), 0);
  const tooSmall = blocks.find((b) => b.size * PHONE_SCALE < (b.kind === "title" ? MIN_TITLE_PT : MIN_BODY_PT)) ?? null;
  const smallestPt = blocks.length ? Math.min(...blocks.map((b) => b.size * PHONE_SCALE)) : 0;
  const text = frameText(frame);
  return {
    fits: used <= available,
    usage: available > 0 ? used / available : Infinity,
    smallestPt,
    tooSmall,
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

// Texto que se dibuja en la imagen (para contar palabras).
export function frameText(frame: PlacedFrame): string {
  if (frame.design?.layout === "stat") return [frame.kind === "story" ? "" : frame.slot.title, frame.design.proof?.statement ?? ""].join(" ");
  switch (frame.kind) {
    case "cover":
      return frame.title;
    case "slide":
      return `${frame.title} ${frame.body}`;
    case "image":
      return `${frame.headline} ${frame.subline}`;
    case "story":
      return `${frame.text} ${frame.stickerText}`;
    case "reel-cover":
      return frame.text;
  }
}

// Estilo Impacto (impact-templates.tsx): márgenes de 88 px, encabezado y pie
// de unos 140 px en total y títulos en Anton.
function impactMetrics(frame: PlacedFrame): FrameMetrics {
  const { height } = sizeOf(frame);
  const vertical = height > 1500;
  const inner = 1080 - 176;
  const area = height - (vertical ? 250 + 360 : 144) - (vertical ? 40 : 140);
  const layout = frame.design?.layout ?? "classic";
  const { title, body } = frame.slot;
  const kicker = frame.slot.kicker ? 40 : 0;
  const T = (text: string, base: number): TextBlock => ({ text: text.toUpperCase(), size: impactTitleSize(text, base), lineHeight: 1.02, width: inner, kind: "title", display: true });
  const B = (text: string, size = 34): TextBlock => ({ text, size, lineHeight: 1.35, width: inner, kind: "body" });
  const present = (b: TextBlock) => b.text.trim().length > 0;
  switch (layout) {
    case "steps":
    case "icon-list": {
      const items = lines(body);
      const size = items.length > 4 ? 40 : 48;
      return { blocks: [...(title.trim() ? [T(title, 110)] : []), ...items.map((l) => ({ text: l.toUpperCase(), size, lineHeight: 1.02, width: inner - 72 - 62, kind: "title" as const, display: true }))], available: area - kicker - 36 - 36 - items.length * 36 };
    }
    case "compare":
      return { blocks: [...(title.trim() ? [T(title, 110)] : []), ...lines(body).slice(0, 1).map((l) => ({ text: l.toUpperCase(), size: 44, lineHeight: 1.05, width: (inner - 20) / 2 - 60, kind: "title" as const, display: true }))], available: area - kicker - 30 - 60 - 48 };
    case "stat":
      return { blocks: [B(frame.design?.proof?.statement ?? "", 40)], available: area - kicker - 340 - 24 };
    case "browser":
    case "cover-device":
    case "phone":
      return { blocks: [T(title, 120), B(body, 32)].filter(present), available: area - kicker - 60 - 260 };
    case "cta":
      return { blocks: [T(title.replace(/\*/g, ""), 120)].filter(present), available: area - kicker - 300 - 100 };
    default: {
      const isCover = frame.kind === "cover" || frame.kind === "image";
      const base = isCover ? 170 : frame.kind === "reel-cover" || frame.kind === "story" ? 150 : 140;
      const main = title.trim() || body.trim();
      const sub = title.trim() ? body : "";
      const number = frame.kind === "slide" && !frame.last ? 60 : 0;
      return { blocks: [T(main, base), B(sub)].filter(present), available: area - Math.max(kicker, number) - 28 * 2 };
    }
  }
}
