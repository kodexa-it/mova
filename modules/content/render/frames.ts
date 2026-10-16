import type { AnyContent, Format, FormatContent } from "@/modules/content/formats";
import { STICKER_LABELS } from "@/modules/content/formats";
import { slotsOf, stripMarks, type Design, type Slot } from "@/modules/content/layouts";

// Qué imágenes tiene cada pieza. Es la lista que recorren la vista previa, la
// descarga y la exportación.
export type Frame =
  | { kind: "cover"; title: string; index: number; total: number }
  | { kind: "slide"; title: string; body: string; index: number; total: number; last: boolean }
  | { kind: "image"; headline: string; subline: string }
  | { kind: "story"; text: string; sticker: string | null; stickerText: string; index: number; total: number }
  | { kind: "reel-cover"; text: string };

export const SIZES = { portrait: { width: 1080, height: 1350 }, vertical: { width: 1080, height: 1920 } } as const;

// Cada imagen con su lugar en la pieza y la composición elegida (si hay).
// `slot` trae el texto limpio (sin marcas de *destacado*); `rich`, el original
// con las marcas, para el estilo Impacto.
export type PlacedFrame = Frame & { slot: Slot; rich: Slot; design?: Design };

export function framesOf(format: Format, content: AnyContent): PlacedFrame[] {
  const slots = slotsOf(format, content as unknown as Record<string, unknown>);
  return baseFrames(format, content).map((frame, i) => {
    const rich = slots[i]!.slot;
    const slot = { ...rich, title: stripMarks(rich.title), body: stripMarks(rich.body) };
    return { ...frame, slot, rich, ...(slots[i]!.design ? { design: slots[i]!.design } : {}) };
  });
}

function baseFrames(format: Format, content: AnyContent): Frame[] {
  switch (format) {
    case "CAROUSEL": {
      const slides = (content as FormatContent<"CAROUSEL">).slides;
      return slides.map((s, i) =>
        i === 0
          ? { kind: "cover" as const, title: stripMarks(s.title), index: 0, total: slides.length }
          : { kind: "slide" as const, title: stripMarks(s.title), body: stripMarks(s.body), index: i, total: slides.length, last: i === slides.length - 1 },
      );
    }
    case "FEED_IMAGE": {
      const c = content as FormatContent<"FEED_IMAGE">;
      return [{ kind: "image", headline: stripMarks(c.headline), subline: stripMarks(c.subline) }];
    }
    case "STORY": {
      const frames = (content as FormatContent<"STORY">).frames;
      return frames.map((f, i) => ({
        kind: "story" as const,
        text: stripMarks(f.text),
        sticker: f.sticker === "NONE" ? null : STICKER_LABELS[f.sticker],
        stickerText: f.stickerText,
        index: i,
        total: frames.length,
      }));
    }
    case "REEL": {
      const c = content as FormatContent<"REEL">;
      return [{ kind: "reel-cover", text: stripMarks(c.coverText || c.hooks[c.selectedHook] || "") }];
    }
  }
}

// Una imagen sin texto todavía no tiene nada que mostrar: la vista previa la
// marca como pendiente en lugar de renderizar un fondo vacío.
export function isBlankFrame(frame: Frame): boolean {
  switch (frame.kind) {
    case "cover":
      return !frame.title.trim();
    case "slide":
      return !frame.title.trim() && !frame.body.trim();
    case "image":
      return !frame.headline.trim() && !frame.subline.trim();
    case "story":
      return !frame.text.trim() && !frame.stickerText.trim();
    case "reel-cover":
      return !frame.text.trim();
  }
}

export function sizeOf(frame: Frame) {
  return frame.kind === "story" || frame.kind === "reel-cover" ? SIZES.vertical : SIZES.portrait;
}

export function frameLabel(format: Format, frame: Frame): string {
  switch (frame.kind) {
    case "cover":
      return "Portada";
    case "slide":
      return `Slide ${frame.index + 1}`;
    case "image":
      return "Imagen";
    case "story":
      return `Frame ${frame.index + 1}`;
    case "reel-cover":
      return format === "REEL" ? "Portada del Reel" : "Portada";
  }
}
