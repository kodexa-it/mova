import "server-only";

import { AiProviderError, type AiProvider, type AiRequest, type AiResponse } from "@/modules/ai/providers/types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

// Adaptador de Anthropic con fetch (sin SDK). La clave viaja solo en el
// encabezado del servidor; nunca se registra. No se envía `temperature`: los
// modelos 5.5 la rechazan (400 "temperature is deprecated for this model").
// El razonamiento extendido se desactiva: por defecto el modelo razona antes de
// responder y esos tokens cuentan dentro de max_tokens; para piezas cortas en
// JSON solo encarece y puede cortar la respuesta (verificado el 15/10/2026).
// Los bloques de razonamiento que igual lleguen se ignoran (solo se lee texto).
// Cómo se apaga el razonamiento depende del modelo: Haiku 5.5 y Opus 5.5
// aceptan {type:"disabled"}; Sonnet 5.5 lo rechaza y pide {type:"between_tools"}
// (verificado el 16/10/2026). Se prueba "disabled" y, si la API indica la otra
// forma, se reintenta una vez y se recuerda para ese modelo.
type ThinkingOff = "disabled" | "between_tools";
const thinkingOff = new Map<string, ThinkingOff>();

export function createAnthropicProvider(apiKey: string): AiProvider {
  async function send(request: AiRequest, thinking: ThinkingOff) {
    try {
      return await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model,
          system: request.system,
          messages: request.messages,
          max_tokens: request.maxTokens,
          thinking: { type: thinking },
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      throw new AiProviderError(error instanceof Error && error.name === "TimeoutError" ? "provider_timeout" : "provider_unreachable");
    }
  }

  return {
    name: "anthropic",
    async complete(request: AiRequest): Promise<AiResponse> {
      const mode = thinkingOff.get(request.model) ?? "disabled";
      let response = await send(request, mode);
      if (!response.ok) {
        let body = (await response.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
        if (response.status === 400 && mode === "disabled" && /between_tools/.test(body?.error?.message ?? "")) {
          thinkingOff.set(request.model, "between_tools");
          response = await send(request, "between_tools");
          body = response.ok ? null : ((await response.json().catch(() => null)) as typeof body);
        }
        if (!response.ok) {
          const detail = body?.error?.message?.replaceAll(apiKey, "[clave]").slice(0, 300);
          throw new AiProviderError(providerErrorCode(response.status, detail ?? ""), detail);
        }
      }
      const data = (await response.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
        stop_reason?: string;
      };
      const text = (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        model: data.model ?? request.model,
        truncated: data.stop_reason === "max_tokens",
      };
    },
  };
}

// Código estable a partir de la respuesta de error de la API.
export function providerErrorCode(status: number, message: string): string {
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 429) return "provider_rate_limited";
  if (status === 400 && /credit balance/i.test(message)) return "provider_no_credits";
  if (status === 404) return "provider_model_not_found";
  if (status === 400) return "provider_rejected";
  return `provider_http_${status}`;
}
