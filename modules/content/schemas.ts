import { z } from "zod";

import { FORMATS } from "@/modules/content/formats";
import { hmSchema, ymdSchema } from "@/modules/plans/schemas";

export const createContentSchema = z.object({
  format: z.enum(FORMATS),
  title: z.string().trim().min(1, "Poné un nombre de trabajo.").max(120),
  pillar: z.string().trim().max(60).nullable().optional(),
  goal: z.string().trim().max(120).nullable().optional(),
  angle: z.string().trim().max(400).optional(),
  // Fecha prevista (opcional): la pieza entra directo al calendario.
  date: ymdSchema.nullable().optional(),
  time: hmSchema.optional(),
  // «Generación visual con IA»: apagado por defecto (modo estándar, sin costo).
  visualMode: z.enum(["STANDARD", "AI"]).optional(),
});

export const updateMetaSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pillar: z.string().trim().max(60).nullable().optional(),
  goal: z.string().trim().max(120).nullable().optional(),
  angle: z.string().trim().max(400).optional(),
  visualMode: z.enum(["STANDARD", "AI"]).optional(),
});
