import "server-only";

import { getEnv } from "@/lib/env";
import { createGeminiImageProvider } from "@/modules/images/providers/gemini";
import type { ImageProvider } from "@/modules/images/providers/types";
import { hasImagePrice } from "@/modules/images/pricing";

let testProvider: ImageProvider | null = null;

// Solo para tests: reemplaza al proveedor real. Fuera de NODE_ENV=test no hay
// ningún proveedor simulado.
export function setImageProviderForTests(provider: ImageProvider | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("setImageProviderForTests solo se usa en tests");
  testProvider = provider;
}

// Proveedor y modelo los decide el servidor (variables de entorno); el
// navegador nunca los elige. Sin clave o sin precio conocido, no hay proveedor.
export function getImageProvider(): { provider: ImageProvider; model: string } | null {
  const model = getEnv().IMAGE_MODEL;
  if (!hasImagePrice(model)) return null;
  if (process.env.NODE_ENV === "test") return testProvider ? { provider: testProvider, model } : null;
  const key = getEnv().GEMINI_API_KEY;
  return key ? { provider: createGeminiImageProvider(key), model } : null;
}
