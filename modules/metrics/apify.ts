import "server-only";

import { AiProviderError } from "@/modules/ai/providers/types";

// Lectura de métricas públicas de una publicación con el actor
// apify/instagram-post-scraper (elegido en la prueba del 13/10: me gusta y
// comentarios coinciden con Instagram; reproducciones sin validar contra la
// app). Se consulta por permalink, con un tope de gasto por ejecución.
const ACTOR = "apify~instagram-post-scraper";
// Costo medido en la prueba con detailedData: USD 0,0027 por publicación. Apify
// informa el costo final segundos después de terminar; se registra esta
// estimación y el tope impide gastar más.
export const APIFY_POST_MICROS = 2_700;
export const APIFY_MAX_CHARGE_USD = 0.01;

export interface PublicMetrics {
  likes: number | null;
  comments: number | null;
  plays: number | null;
  shortcode: string | null;
}

export async function fetchPostMetrics(token: string, permalink: string): Promise<PublicMetrics> {
  let response: Response;
  try {
    response = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?maxTotalChargeUsd=${APIFY_MAX_CHARGE_USD}&timeout=110`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: [permalink], dataDetailLevel: "detailedData" }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new AiProviderError(error instanceof Error && error.name === "TimeoutError" ? "provider_timeout" : "provider_unreachable");
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replaceAll(token, "[token]").slice(0, 300);
    throw new AiProviderError(response.status === 401 || response.status === 403 ? "provider_auth" : response.status === 402 ? "provider_no_credits" : `provider_http_${response.status}`, detail);
  }
  return parseApifyItems(await response.json());
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

export function parseApifyItems(raw: unknown): PublicMetrics {
  const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const item = items.find((i) => !i.error && (i.shortCode || i.url));
  if (!item) throw new AiProviderError("provider_no_data", String(items[0]?.error ?? items[0]?.errorDescription ?? "sin resultados").slice(0, 200));
  return {
    // Instagram oculta los me gusta en algunas cuentas: Apify devuelve -1 o nada.
    likes: num(item.likesCount),
    comments: num(item.commentsCount),
    plays: num(item.videoPlayCount),
    shortcode: typeof item.shortCode === "string" ? item.shortCode : null,
  };
}
