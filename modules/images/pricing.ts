// Precios de los modelos de imágenes, en USD. Fuente: página oficial de precios
// de la Gemini API (ai.google.dev/gemini-api/docs/pricing), consultada el
// 15/10/2026, nivel estándar (no batch). Revisarlos al cambiar de modelo: la
// estimación que ve la persona y el costo registrado salen de esta tabla.
export type ImageSize = "1K" | "2K";
export type AspectRatio = "4:5" | "9:16";

interface ImagePrice {
  label: string;
  provider: "gemini";
  // Precio publicado por imagen generada, según resolución.
  perImage: Record<ImageSize, number>;
  // Por millón de tokens: entrada (texto) y salida de imagen.
  inputPerMTok: number;
  outputImagePerMTok: number;
}

export const IMAGE_PRICES: Record<string, ImagePrice> = {
  // Nano Banana 2. USD 60 por millón de tokens de imagen = USD 0,067 por
  // imagen 1K y USD 0,101 por imagen 2K. Entrada USD 0,50 por millón.
  "gemini-3.1-flash-image": { label: "Gemini 3.1 Flash Image", provider: "gemini", perImage: { "1K": 0.067, "2K": 0.101 }, inputPerMTok: 0.5, outputImagePerMTok: 60 },
};

export const IMAGE_PRICES_CHECKED = "15/10/2026";

export function hasImagePrice(model: string): boolean {
  return Object.hasOwn(IMAGE_PRICES, model);
}

// Estimación antes de llamar: el precio publicado de la imagen más el texto del
// pedido (3 caracteres por token, conservador para español e inglés).
export function estimateImageMicros(model: string, promptChars: number, size: ImageSize): number {
  const price = IMAGE_PRICES[model];
  if (!price) throw new Error(`Sin precio para el modelo de imágenes ${model}`);
  return Math.ceil(price.perImage[size] * 1_000_000 + Math.ceil(promptChars / 3) * price.inputPerMTok);
}

// Lo que se reserva del límite mientras la imagen se genera: la estimación más
// un 25 % (por si el modelo usa tokens de razonamiento, que también se cobran).
export function reserveImageMicros(estimate: number): number {
  return Math.ceil(estimate * 1.25);
}

// Costo con el consumo que informó el proveedor. Los tokens de salida se
// valúan todos al precio de imagen (el más alto): nunca subestima.
export function imageCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const price = IMAGE_PRICES[model];
  if (!price) throw new Error(`Sin precio para el modelo de imágenes ${model}`);
  return Math.ceil(inputTokens * price.inputPerMTok + outputTokens * price.outputImagePerMTok);
}
