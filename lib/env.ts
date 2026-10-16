import "server-only";

import { z } from "zod";

// Única puerta de entrada a las variables de entorno del servidor. Si falta
// una obligatoria o tiene un formato inválido, la app no arranca y el error
// dice cuál es, nunca su valor.
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    APP_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
    EMAIL_TRANSPORT: z.enum(["smtp", "console", "memory"]).default("console"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_FROM: z.string().min(3).default("Mova <no-responder@mova.local>"),
    APIFY_TOKEN: z.string().optional(),
    // IA (etapa 2). Sin clave, Mova funciona igual y el asistente queda apagado.
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL_FAST: z.string().min(1).default("claude-haiku-5-5"),
    AI_MODEL_SMART: z.string().min(1).default("claude-sonnet-5-5"),
    // Imágenes con IA (modo premium). Sin clave, el modo queda apagado. El
    // modelo lo fija el servidor y tiene que estar en la tabla de precios.
    GEMINI_API_KEY: z.string().optional(),
    // Secreto para ejecutar la cola de tareas desde un programador externo
    // (función programada de Netlify). Sin él, ese endpoint queda cerrado.
    CRON_SECRET: z.string().min(24).optional(),
    IMAGE_MODEL: z.string().min(1).default("gemini-3.1-flash-image"),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_TRANSPORT === "smtp" && (!value.SMTP_HOST || !value.SMTP_PORT)) {
      ctx.addIssue({ code: "custom", message: "EMAIL_TRANSPORT=smtp requiere SMTP_HOST y SMTP_PORT" });
    }
    // En un despliegue real el email tiene que salir de verdad. Solo se permite
    // otro transporte si la app corre en localhost (probar el build local).
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value.APP_URL.replace(/\/$/, ""));
    if (value.NODE_ENV === "production" && value.EMAIL_TRANSPORT !== "smtp" && !local) {
      ctx.addIssue({ code: "custom", message: "En producción el email no puede ser console ni memory" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`);
    throw new Error(`Variables de entorno inválidas:\n${problems.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

// Origins desde las que se acepta una mutación o un login. En producción, solo
// la de APP_URL. En desarrollo local, si APP_URL es localhost también se acepta
// 127.0.0.1 en el mismo puerto (y viceversa): son el mismo servidor y el
// navegador los trata como orígenes distintos.
export function allowedOrigins(env: Pick<Env, "APP_URL" | "NODE_ENV">): string[] {
  const url = new URL(env.APP_URL);
  const origins = [url.origin];
  if (env.NODE_ENV !== "production" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    const alt = new URL(url.origin);
    alt.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(alt.origin);
  }
  return origins;
}

// Solo para tests: permite recargar después de cambiar process.env.
export function resetEnvCache(): void {
  cached = null;
}
