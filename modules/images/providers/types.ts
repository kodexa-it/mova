import type { AspectRatio, ImageSize } from "@/modules/images/pricing";

export interface ImageRequest {
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

export interface ImageResult {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  // Consumo informado por el proveedor (null si no lo informó).
  usage: { inputTokens: number; outputTokens: number } | null;
}

// Proveedor intercambiable de imágenes: Mova solo conoce esta interfaz. Los
// errores usan AiProviderError (mismos códigos que el de texto).
export interface ImageProvider {
  readonly name: string;
  generate(request: ImageRequest): Promise<ImageResult>;
}
