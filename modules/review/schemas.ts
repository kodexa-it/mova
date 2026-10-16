import { z } from "zod";

export const approveSchema = z.object({
  versionId: z.string().min(1).max(40),
  note: z.string().trim().max(1000).default(""),
});

export const requestChangesSchema = z.object({
  versionId: z.string().min(1).max(40),
  note: z.string().trim().min(3, "Contá qué hay que cambiar.").max(1000),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escribí el comentario.").max(2000),
});
