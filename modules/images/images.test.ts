import { afterEach, describe, expect, it, vi } from "vitest";

import { AiProviderError } from "@/modules/ai/providers/types";
import { estimateImageMicros, imageCostMicros, reserveImageMicros } from "@/modules/images/pricing";
import { buildArtPrompt, imageDimensions, promptHash } from "@/modules/images/prompt";
import { createGeminiImageProvider, geminiBody, geminiErrorCode, parseGeminiImage } from "@/modules/images/providers/gemini";

afterEach(() => vi.unstubAllGlobals());

// PNG real de 4×5 píxeles.
export const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz9qMAAAAEElEQVR4nGP4z8AARwxkcACbwRPtBhPQCgAAAABJRU5ErkJggg==";
const request = { model: "gemini-3.1-flash-image", prompt: "Una imagen", aspectRatio: "4:5" as const, imageSize: "1K" as const };
const BRAND = { industry: "Software", description: "Desarrollamos productos digitales para pymes.", imageStyle: "", palette: [{ name: "Naranja", hex: "#FE6A00" }], audiences: ["Pymes"] };

describe("precios de imágenes (Gemini, precio publicado)", () => {
  it("estima con el precio por imagen más el texto del pedido", () => {
    expect(estimateImageMicros("gemini-3.1-flash-image", 0, "1K")).toBe(67_000);
    expect(estimateImageMicros("gemini-3.1-flash-image", 3000, "2K")).toBe(101_000 + 500);
    expect(reserveImageMicros(67_000)).toBe(83_750);
  });

  it("costo real con el consumo informado (USD 60 por millón de tokens de imagen)", () => {
    // 1120 tokens de una imagen 1K = USD 0,0672.
    expect(imageCostMicros("gemini-3.1-flash-image", 400, 1120)).toBe(200 + 67_200);
  });

  it("un modelo sin precio no se puede usar", () => {
    expect(() => estimateImageMicros("otro-modelo", 10, "1K")).toThrow(/Sin precio/);
  });
});

describe("pedido al modelo de imágenes", () => {
  const prompt = buildArtPrompt({ brand: BRAND, slot: { role: "cover", title: "Tu web pierde consultas", body: "" }, layout: "art-cover", aspectRatio: "4:5", brief: "escritorio luminoso" });

  it("prohíbe texto, logos, marcas, capturas y resultados inventados", () => {
    expect(prompt).toMatch(/No text of any kind/);
    expect(prompt).toMatch(/logos/);
    expect(prompt).toMatch(/real client work, website or app screenshots/);
    expect(prompt).toMatch(/testimonials or results/);
    expect(prompt).toMatch(/never write it in the image/);
  });

  it("usa la paleta, el contexto de la marca, la composición y la dirección de arte", () => {
    expect(prompt).toContain("#FE6A00");
    expect(prompt).toContain("Software");
    expect(prompt).toMatch(/lower 45% must be calm/);
    expect(prompt).toContain("escritorio luminoso");
  });

  it("la huella cambia con el texto, el modelo o la medida", () => {
    const a = promptHash("m", "4:5", "1K", prompt);
    expect(promptHash("m", "4:5", "1K", prompt)).toBe(a);
    expect(promptHash("m", "9:16", "1K", prompt)).not.toBe(a);
    expect(promptHash("m", "4:5", "2K", prompt)).not.toBe(a);
  });

  it("lee el tamaño de un PNG", () => {
    expect(imageDimensions(new Uint8Array(Buffer.from(PNG_B64, "base64")))).toEqual({ width: 4, height: 5 });
  });
});

describe("adaptador de Gemini", () => {
  it("pide solo imagen, con proporción y resolución, y la clave en el encabezado", async () => {
    const fetchMock = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG_B64 } }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 1120 } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await createGeminiImageProvider("clave-secreta").generate(request);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("clave-secreta");
    expect(url).not.toContain("clave-secreta");
    expect(JSON.parse(init.body as string)).toEqual(geminiBody(request));
    expect(JSON.parse(init.body as string).generationConfig).toEqual({ responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5", imageSize: "1K" } });
    expect(result.mimeType).toBe("image/png");
    expect(result.usage).toEqual({ inputTokens: 300, outputTokens: 1120 });
  });

  it("sin consumo informado devuelve usage null (se registra la estimación)", () => {
    expect(parseGeminiImage({ candidates: [{ content: { parts: [{ inline_data: { mime_type: "image/png", data: PNG_B64 } }] } }] }).usage).toBeNull();
  });

  it("una respuesta bloqueada o sin imagen es un error estable", () => {
    expect(() => parseGeminiImage({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(AiProviderError);
    expect(() => parseGeminiImage({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] })).toThrow(expect.objectContaining({ code: "provider_rejected" }));
    expect(() => parseGeminiImage({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "no puedo" }] } }] })).toThrow(expect.objectContaining({ code: "provider_no_image" }));
  });

  it("traduce los errores HTTP sin filtrar la clave", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { status: "INVALID_ARGUMENT", message: "API key not valid: clave-secreta" } }, { status: 400 }));
    const error = await createGeminiImageProvider("clave-secreta").generate(request).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "provider_auth" });
    expect((error as AiProviderError).detail).not.toContain("clave-secreta");
    expect(geminiErrorCode(429, "RESOURCE_EXHAUSTED quota exceeded, limit: 0")).toBe("provider_no_credits");
    expect(geminiErrorCode(429, "RESOURCE_EXHAUSTED")).toBe("provider_rate_limited");
    expect(geminiErrorCode(404, "NOT_FOUND")).toBe("provider_model_not_found");
    expect(geminiErrorCode(500, "INTERNAL")).toBe("provider_http_500");
  });

  it("un corte de red o un timeout no rompe: es un error del proveedor", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    expect(await createGeminiImageProvider("k").generate(request).catch((e: unknown) => e)).toMatchObject({ code: "provider_unreachable" });
  });
});
