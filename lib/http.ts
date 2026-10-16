import "server-only";

import type { z } from "zod";

import { allowedOrigins, getEnv } from "@/lib/env";

// Error con código HTTP y un código estable para la interfaz. El mensaje
// nunca incluye detalles internos.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export const unauthorized = () => new HttpError(401, "unauthenticated");
export const forbidden = () => new HttpError(403, "forbidden");
export const notFound = () => new HttpError(404, "not_found");
export const conflict = (code: string) => new HttpError(409, code);
export const badRequest = (code = "invalid_input") => new HttpError(400, code);

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// Envuelve un route handler: convierte HttpError en respuestas JSON y oculta
// cualquier otro error detrás de un 500 genérico.
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code }, error.status);
      console.error("[api] error no controlado:", error instanceof Error ? error.message : error);
      return json({ error: "internal_error" }, 500);
    }
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Protección CSRF para nuestras rutas: toda mutación debe venir de la misma
// origin que la app. Los navegadores siempre envían Origin en POST/PATCH/DELETE.
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(getEnv()).includes(origin)) throw forbidden();
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest();
  return parsed.data;
}

export function clientIp(headers: Headers): string | null {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
