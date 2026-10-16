import { z } from "zod";

import { FORMATS } from "@/modules/content/formats";
import { HM_RE, isYmd, weekdayOf } from "@/lib/time";

const CONTENT_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED", "ARCHIVED"] as const;

export const ymdSchema = z.string().refine(isYmd, "Elegí una fecha válida.");
export const hmSchema = z.string().regex(HM_RE, "Elegí una hora válida.");
export const weekStartSchema = ymdSchema.refine((d) => weekdayOf(d) === 1, "La semana empieza el lunes.");

export const DEFAULT_TIME = "10:00";

// Fecha y hora de publicación prevista. Sin fecha, la pieza queda fuera del calendario.
export const scheduleSchema = z.object({
  date: ymdSchema.nullable(),
  time: hmSchema.optional(),
});

export const planFocusSchema = z.object({
  focus: z.string().trim().max(400, "Hasta 400 caracteres."),
});

export const calendarQuerySchema = z.object({
  from: ymdSchema,
  to: ymdSchema,
  format: z.enum(FORMATS).optional(),
  status: z.enum([...CONTENT_STATUSES, "ACTIVE"]).optional(),
  pillar: z.string().trim().max(60).optional(),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export { CONTENT_STATUSES };
