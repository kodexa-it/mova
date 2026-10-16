import { afterEach, describe, expect, it, vi } from "vitest";

import { createAnthropicProvider, providerErrorCode } from "@/modules/ai/providers/anthropic";
import { AiProviderError } from "@/modules/ai/providers/types";

afterEach(() => vi.unstubAllGlobals());

const request = { model: "claude-haiku-5-5", system: "Sistema", messages: [{ role: "user" as const, content: "Hola" }], maxTokens: 50 };

describe("adaptador de Anthropic", () => {
  it("no envía temperature (los modelos 5.5 la rechazan) y desactiva el razonamiento extendido", async () => {
    const fetchMock = vi.fn(async () => Response.json({ content: [{ type: "text", text: "Hola" }], usage: { input_tokens: 3, output_tokens: 1 }, model: "claude-haiku-5-5" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await createAnthropicProvider("sk-ant-prueba").complete(request);
    expect(result).toMatchObject({ text: "Hola", inputTokens: 3, outputTokens: 1 });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ model: "claude-haiku-5-5", system: "Sistema", messages: request.messages, max_tokens: 50, thinking: { type: "disabled" } });
    expect(result.truncated).toBe(false);
  });

  it("marca la respuesta cortada por max_tokens", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: "{\"a\":" }], usage: { input_tokens: 3, output_tokens: 50 }, stop_reason: "max_tokens" }));
    expect(await createAnthropicProvider("sk-ant-prueba").complete(request)).toMatchObject({ text: "{\"a\":", truncated: true });
  });

  it("convierte un 400 en un código estable y guarda el detalle sin la clave", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ type: "error", error: { type: "invalid_request_error", message: "`temperature` is deprecated for this model." } }, { status: 400 }));
    const error = await createAnthropicProvider("sk-ant-prueba").complete(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ code: "provider_rejected", detail: "`temperature` is deprecated for this model." });
  });

  it("clasifica los errores habituales", () => {
    expect(providerErrorCode(401, "")).toBe("provider_auth");
    expect(providerErrorCode(429, "")).toBe("provider_rate_limited");
    expect(providerErrorCode(400, "Your credit balance is too low to access the Anthropic API.")).toBe("provider_no_credits");
    expect(providerErrorCode(404, "model: claude-x")).toBe("provider_model_not_found");
    expect(providerErrorCode(529, "Overloaded")).toBe("provider_http_529");
  });

  it("si el modelo pide otra forma de apagar el razonamiento (Sonnet 5.5), reintenta una vez y la recuerda", async () => {
    const bodies: { thinking: unknown }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      bodies.push(body);
      if (body.thinking.type === "disabled")
        return Response.json({ type: "error", error: { type: "invalid_request_error", message: 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}.' } }, { status: 400 });
      return Response.json({ content: [{ type: "text", text: "Hola" }], usage: { input_tokens: 3, output_tokens: 1 } });
    });
    const provider = createAnthropicProvider("sk-ant-prueba");
    const sonnet = { ...request, model: "claude-sonnet-prueba" };
    expect(await provider.complete(sonnet)).toMatchObject({ text: "Hola" });
    expect(await provider.complete(sonnet)).toMatchObject({ text: "Hola" });
    expect(bodies.map((b) => b.thinking)).toEqual([{ type: "disabled" }, { type: "between_tools" }, { type: "between_tools" }]);
  });
});
