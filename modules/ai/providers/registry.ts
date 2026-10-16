import "server-only";

import { getEnv } from "@/lib/env";
import { createAnthropicProvider } from "@/modules/ai/providers/anthropic";
import type { AiProvider } from "@/modules/ai/providers/types";

let testProvider: AiProvider | null = null;

// Solo para tests: reemplaza al proveedor real por uno programado. Fuera de
// NODE_ENV=test no existe ningún proveedor simulado.
export function setProviderForTests(provider: AiProvider | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("setProviderForTests solo se usa en tests");
  testProvider = provider;
}

export function getProvider(): AiProvider | null {
  if (process.env.NODE_ENV === "test") return testProvider;
  const key = getEnv().ANTHROPIC_API_KEY;
  return key ? createAnthropicProvider(key) : null;
}

export function modelFor(tier: "fast" | "smart"): string {
  const env = getEnv();
  return tier === "fast" ? env.AI_MODEL_FAST : env.AI_MODEL_SMART;
}
