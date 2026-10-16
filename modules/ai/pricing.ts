// Precios por millón de tokens, en USD. Fuente: página oficial de precios de
// Anthropic (platform.claude.com/docs/en/about-claude/pricing), consultada el
// 14/10/2026. Revisarlos al cambiar de modelo: el costo registrado depende de
// esta tabla.
interface Price {
  input: number;
  output: number;
  // Haiku 5.5 cobra más cuando el prompt supera 100.000 tokens.
  longContext?: { thresholdTokens: number; input: number; output: number };
}

export const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longContext: { thresholdTokens: 100_000, input: 0.5, output: 2.5 } },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export const MICROS_PER_USD = 1_000_000;

export function hasPrice(model: string): boolean {
  return Object.hasOwn(PRICES, model);
}

// Costo en micro-dólares, redondeado hacia arriba para no subestimar.
export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price) throw new Error(`Sin precio para el modelo ${model}`);
  const tier = price.longContext && inputTokens > price.longContext.thresholdTokens ? price.longContext : price;
  // USD por MTok equivale a micro-USD por token.
  return Math.ceil(inputTokens * tier.input + outputTokens * tier.output);
}

// Estimación conservadora antes de llamar: 3 caracteres por token de entrada
// (en español suelen ser más) y el máximo de tokens de salida permitido.
export function estimateMaxMicros(model: string, inputChars: number, maxOutputTokens: number): number {
  return costMicros(model, Math.ceil(inputChars / 3), maxOutputTokens);
}

export function formatUsd(micros: number): string {
  const usd = micros / MICROS_PER_USD;
  return `USD ${usd.toLocaleString("es-AR", { minimumFractionDigits: usd < 1 ? 4 : 2, maximumFractionDigits: usd < 1 ? 4 : 2 })}`;
}
