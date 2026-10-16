import "server-only";

import { AiProviderError } from "@/modules/ai/providers/types";
import type { ImageProvider, ImageRequest, ImageResult } from "@/modules/images/providers/types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Adaptador de la Gemini API para imágenes (generateContent con salida de
// imagen), con fetch y sin SDK. La clave viaja solo en el encabezado del
// servidor y se borra de cualquier mensaje de error antes de registrarlo.
// Formato del pedido según la documentación oficial de generación de imágenes
// (responseModalities + imageConfig con aspectRatio e imageSize).
export function createGeminiImageProvider(apiKey: string): ImageProvider {
  return {
    name: "gemini",
    async generate(request: ImageRequest): Promise<ImageResult> {
      let response: Response;
      try {
        response = await fetch(`${BASE}/${encodeURIComponent(request.model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(geminiBody(request)),
          signal: AbortSignal.timeout(120_000),
        });
      } catch (error) {
        throw new AiProviderError(error instanceof Error && error.name === "TimeoutError" ? "provider_timeout" : "provider_unreachable");
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
        const detail = `${body?.error?.status ?? ""} ${body?.error?.message ?? ""}`.replaceAll(apiKey, "[clave]").trim().slice(0, 300);
        throw new AiProviderError(geminiErrorCode(response.status, detail), detail);
      }
      return parseGeminiImage(await response.json());
    },
  };
}

export function geminiBody(request: ImageRequest) {
  return {
    contents: [{ role: "user", parts: [{ text: request.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: request.aspectRatio, imageSize: request.imageSize },
    },
  };
}

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
interface GeminiResponse {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

const MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export function parseGeminiImage(raw: unknown): ImageResult {
  const data = (raw ?? {}) as GeminiResponse;
  if (data.promptFeedback?.blockReason) throw new AiProviderError("provider_rejected", `bloqueado: ${data.promptFeedback.blockReason}`);
  const candidate = data.candidates?.[0];
  const part = candidate?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const inline = part?.inlineData ?? (part?.inline_data ? { mimeType: part.inline_data.mime_type, data: part.inline_data.data } : undefined);
  if (!inline?.data) {
    const reason = candidate?.finishReason ?? "sin imagen";
    throw new AiProviderError(/SAFETY|PROHIBITED|BLOCK|RECITATION|IMAGE_/i.test(reason) ? "provider_rejected" : "provider_no_image", reason);
  }
  const mimeType = (inline.mimeType ?? "image/png").toLowerCase();
  if (!MIME.has(mimeType)) throw new AiProviderError("provider_no_image", `formato ${mimeType}`);
  const usage = data.usageMetadata;
  return {
    bytes: new Uint8Array(Buffer.from(inline.data, "base64")),
    mimeType: mimeType as ImageResult["mimeType"],
    usage:
      usage && typeof usage.candidatesTokenCount === "number"
        ? { inputTokens: usage.promptTokenCount ?? 0, outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) }
        : null,
  };
}

// Código estable a partir del error de la API de Google.
export function geminiErrorCode(status: number, detail: string): string {
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(detail)) return "provider_auth";
  if (/billing|FAILED_PRECONDITION|limit: 0|free.tier/i.test(detail)) return "provider_no_credits";
  if (status === 429) return "provider_rate_limited";
  if (status === 404) return "provider_model_not_found";
  if (status === 400) return "provider_rejected";
  return `provider_http_${status}`;
}
