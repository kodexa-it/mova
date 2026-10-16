import { z } from "zod";

// Mensajes por defecto en español para los casos sin mensaje propio.
z.config(z.locales.es());

// Secciones del perfil de marca, en el orden del asistente. Este módulo no
// depende del servidor: lo usan la API (validación) y la interfaz (formularios).

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1, "Completá este campo.").max(max);
const list = (max: number, itemMax = 60) => z.array(z.string().trim().min(1).max(itemMax)).max(max);
const dial = z.number().int().min(1).max(5);

export const identitySchema = z.object({
  name: required(80),
  industry: required(80),
  description: z.string().trim().min(20, "Contalo en al menos 20 caracteres.").max(600),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/, message: "Ingresá una dirección completa, con https://." })]),
  audienceTimezone: required(60),
});

export const offeringsSchema = z.object({
  items: z
    .array(z.object({ name: required(80), description: text(400) }))
    .min(1, "Agregá al menos un servicio o producto.")
    .max(12),
});

export const audiencesSchema = z.object({
  items: z
    .array(z.object({ name: required(80), description: text(400), painPoints: list(6, 140) }))
    .min(1, "Agregá al menos un público.")
    .max(6),
});

export const goalsSchema = z.object({
  items: z
    .array(z.object({ title: required(120), kpi: text(120), target: text(80) }))
    .min(1, "Agregá al menos un objetivo.")
    .max(5),
});

export const voiceSchema = z.object({
  formality: dial,
  humor: dial,
  technicality: dial,
  enthusiasm: dial,
  wordsToUse: list(20),
  wordsToAvoid: list(20),
  emojiPolicy: z.enum(["NONE", "FEW", "FREE"]),
  examples: list(5, 600),
});

export const pillarsSchema = z.object({
  items: z
    .array(z.object({ name: required(60), description: text(300), weight: z.number({ error: "Ingresá un porcentaje." }).int("Usá un número entero.").min(5, "Mínimo 5 %.").max(80, "Máximo 80 %.") }))
    .min(2, "Definí al menos dos pilares.")
    .max(6)
    .refine((items) => items.reduce((sum, item) => sum + item.weight, 0) === 100, {
      message: "Los porcentajes tienen que sumar 100.",
    }),
});

export const HEX = /^#[0-9a-f]{6}$/i;

export const visualSchema = z.object({
  palette: z
    .array(z.object({ name: required(40), hex: z.string().regex(HEX, "Usá un color en formato #RRGGBB.") }))
    .min(1, "Agregá al menos el color principal.")
    .max(6),
  headingFont: text(60),
  bodyFont: text(60),
  imageStyle: text(400),
});

export const proofsSchema = z.object({
  items: z.array(z.object({ statement: required(300), source: required(200) })).max(30),
});

export const rulesSchema = z.object({
  items: z.array(z.object({ kind: z.enum(["ALWAYS", "NEVER"]), text: required(240) })).max(30),
});

export const SECTIONS = {
  identidad: {
    title: "Identidad",
    summary: "Nombre, rubro y qué hace la marca.",
    required: true,
    schema: identitySchema,
  },
  servicios: {
    title: "Servicios",
    summary: "Lo que vende o hace la marca.",
    required: true,
    schema: offeringsSchema,
  },
  publico: {
    title: "Público",
    summary: "A quién le habla y qué le preocupa.",
    required: true,
    schema: audiencesSchema,
  },
  objetivos: {
    title: "Objetivos",
    summary: "Qué tiene que lograr la comunicación y cómo se mide.",
    required: true,
    schema: goalsSchema,
  },
  voz: {
    title: "Voz y tono",
    summary: "Cómo suena: registro, palabras y emojis.",
    required: true,
    schema: voiceSchema,
  },
  pilares: {
    title: "Pilares de contenido",
    summary: "Los temas de la semana y cuánto pesa cada uno.",
    required: true,
    schema: pillarsSchema,
  },
  visual: {
    title: "Identidad visual",
    summary: "Colores, tipografías y estilo de imagen.",
    required: true,
    schema: visualSchema,
  },
  datos: {
    title: "Datos publicables",
    summary: "Cifras y hechos reales que Mova puede usar, con su fuente.",
    required: false,
    schema: proofsSchema,
  },
  reglas: {
    title: "Reglas",
    summary: "Lo que la marca siempre hace y lo que nunca hace.",
    required: false,
    schema: rulesSchema,
  },
} as const;

export type SectionKey = keyof typeof SECTIONS;
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];
export type SectionInput<K extends SectionKey> = z.infer<(typeof SECTIONS)[K]["schema"]>;

export function isSectionKey(value: string): value is SectionKey {
  return Object.hasOwn(SECTIONS, value);
}

export function nextSection(key: SectionKey): SectionKey | null {
  const index = SECTION_KEYS.indexOf(key);
  return SECTION_KEYS[index + 1] ?? null;
}

export const EMOJI_LABELS = { NONE: "Sin emojis", FEW: "Pocos, con criterio", FREE: "Libres" } as const;

export const DIALS = [
  { key: "formality", label: "Registro", low: "Cercano", high: "Formal" },
  { key: "humor", label: "Humor", low: "Serio", high: "Divertido" },
  { key: "technicality", label: "Lenguaje", low: "Simple", high: "Técnico" },
  { key: "enthusiasm", label: "Energía", low: "Sobrio", high: "Entusiasta" },
] as const;
