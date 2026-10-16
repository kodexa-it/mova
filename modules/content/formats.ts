import { z } from "zod";

import { designSchema, pieceStyleSchema } from "@/modules/content/layouts";

// Formatos de pieza y su contenido. Este módulo no depende del servidor: lo
// usan la API, la IA (forma de la respuesta) y los formularios.
z.config(z.locales.es());

export const FORMATS = ["FEED_IMAGE", "CAROUSEL", "REEL", "STORY"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABELS: Record<Format, string> = {
  FEED_IMAGE: "Publicación",
  CAROUSEL: "Carrusel",
  REEL: "Reel",
  STORY: "Stories",
};

export const FORMAT_HINTS: Record<Format, string> = {
  FEED_IMAGE: "Una imagen con un titular y el caption.",
  CAROUSEL: "De 3 a 10 slides: portada, una idea por slide y cierre.",
  REEL: "Tres hooks para elegir, guion por líneas, texto en pantalla y portada. El video lo graba la marca.",
  STORY: "De 3 a 7 frames. Los stickers se agregan a mano al publicar.",
};

const line = (max: number) => z.string().trim().max(max);
const req = (max: number) => z.string().trim().min(1, "Completá este campo.").max(max);

const common = {
  caption: z.string().trim().max(2200),
  altText: line(1000),
  hashtags: z.array(z.string().trim().regex(/^#?[\p{L}\p{N}_]+$/u, "Usá un hashtag sin espacios.")).max(5, "Instagram toma hasta 5 hashtags."),
  // Estilo de las composiciones (preset y patrón de marca). Sin campo = el de la marca.
  style: pieceStyleSchema.optional(),
};

export const feedImageSchema = z.object({
  ...common,
  headline: req(80),
  subline: line(140),
  visualNotes: line(400),
  design: designSchema.optional(),
});

export const carouselSchema = z.object({
  ...common,
  slides: z
    .array(z.object({ kicker: line(40).optional(), title: req(80), body: line(260), design: designSchema.optional() }))
    .min(3, "Un carrusel necesita al menos 3 slides.")
    .max(10, "Instagram publica hasta 10 slides por carrusel."),
});

export const REEL_TARGETS = [15, 30, 45, 60, 90] as const;

export const reelSchema = z.object({
  ...common,
  hooks: z.array(req(140)).min(1).max(3),
  selectedHook: z.number().int().min(0).max(2),
  script: z.array(z.object({ say: req(280), onScreen: line(80) })).min(2, "El guion necesita al menos 2 líneas.").max(30),
  targetSeconds: z
    .number()
    .int()
    .refine((n) => (REEL_TARGETS as readonly number[]).includes(n), "Elegí 15, 30, 45, 60 o 90 segundos."),
  coverText: line(60),
  design: designSchema.optional(),
});

export const STICKERS = ["NONE", "POLL", "QUESTION", "QUIZ", "LINK", "COUNTDOWN"] as const;
export const STICKER_LABELS: Record<(typeof STICKERS)[number], string> = {
  NONE: "Sin sticker",
  POLL: "Encuesta",
  QUESTION: "Pregunta",
  QUIZ: "Quiz",
  LINK: "Enlace",
  COUNTDOWN: "Cuenta regresiva",
};

export const storySchema = z.object({
  ...common,
  frames: z
    .array(z.object({ text: req(200), sticker: z.enum(STICKERS), stickerText: line(80), design: designSchema.optional() }))
    .min(3, "Una secuencia necesita al menos 3 frames.")
    .max(7, "Más de 7 frames se pierden: armá dos secuencias."),
});

export const FORMAT_SCHEMAS = {
  FEED_IMAGE: feedImageSchema,
  CAROUSEL: carouselSchema,
  REEL: reelSchema,
  STORY: storySchema,
} as const;

export type FormatContent<F extends Format> = z.infer<(typeof FORMAT_SCHEMAS)[F]>;
export type AnyContent = FormatContent<Format>;

export function emptyContent(format: Format): AnyContent {
  const base = { caption: "", altText: "", hashtags: [] as string[] };
  switch (format) {
    case "FEED_IMAGE":
      return { ...base, headline: "", subline: "", visualNotes: "" };
    case "CAROUSEL":
      return { ...base, slides: [0, 1, 2].map(() => ({ title: "", body: "" })) };
    case "REEL":
      return { ...base, hooks: ["", "", ""], selectedHook: 0, script: [{ say: "", onScreen: "" }, { say: "", onScreen: "" }], targetSeconds: 30, coverText: "" };
    case "STORY":
      return { ...base, frames: [0, 1, 2].map(() => ({ text: "", sticker: "NONE" as const, stickerText: "" })) };
  }
}

// Todo el texto visible de una pieza, para los validadores de marca.
export function allText(format: Format, content: AnyContent): string {
  const parts: string[] = [content.caption, content.altText];
  switch (format) {
    case "FEED_IMAGE": {
      const c = content as FormatContent<"FEED_IMAGE">;
      parts.push(c.headline, c.subline);
      break;
    }
    case "CAROUSEL":
      for (const s of (content as FormatContent<"CAROUSEL">).slides) parts.push(s.kicker ?? "", s.title, s.body);
      break;
    case "REEL": {
      const c = content as FormatContent<"REEL">;
      parts.push(...c.hooks, c.coverText, ...c.script.flatMap((l) => [l.say, l.onScreen]));
      break;
    }
    case "STORY":
      for (const f of (content as FormatContent<"STORY">).frames) parts.push(f.text, f.stickerText);
      break;
  }
  return parts.filter(Boolean).join("\n");
}
