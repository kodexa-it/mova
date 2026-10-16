// Formato común de los validadores. Son determinísticos: no usan IA ni red.
export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export type Verdict = "ready" | "review" | "fix";

export function verdictOf(checks: Check[]): Verdict {
  if (checks.some((c) => c.status === "fail")) return "fix";
  if (checks.some((c) => c.status === "warn")) return "review";
  return "ready";
}

export const clamp = (n: number) => Math.max(0, Math.min(100, n));

// Palabras en español: letras con tilde y ñ, cifras y signos de moneda.
export const WORD_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9$%'’-]+/g;

export function words(text: string): string[] {
  // "$18.000" o "18,5" se dicen como una sola palabra.
  return text.replace(/(?<=\d)[.,](?=\d)/g, "").match(WORD_RE) ?? [];
}

// \b de JavaScript no reconoce letras con tilde ("dejá" no termina en un
// límite de palabra). wre() reemplaza \b por un límite Unicode real.
const BOUNDARY = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";

export function wre(source: string, flags = "i"): RegExp {
  return new RegExp(source.replaceAll("\\b", BOUNDARY), `${flags}u`);
}

// Algo comprobable: una cifra, un precio o un nombre propio que no abre la oración.
export const CONCRETE_RE = /\$\s?\d|(?<![\p{L}\p{N}])\d[\d.,]*\s?%?|(?<![.!?¡¿]\s|^)(?<!\p{L})[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?!\p{L})/gmu;

export function concreteMarkers(text: string): string[] {
  return (text.match(CONCRETE_RE) ?? []).map((m) => m.trim()).filter(Boolean);
}
