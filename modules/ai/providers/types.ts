export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
}

export interface AiResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  // true si el modelo cortó la respuesta por llegar a maxTokens.
  truncated: boolean;
}

// Proveedor intercambiable: Mova solo conoce esta interfaz.
export interface AiProvider {
  readonly name: string;
  complete(request: AiRequest): Promise<AiResponse>;
}

// Error del proveedor con un código estable para el registro. El detalle (el
// mensaje del proveedor, recortado) solo se escribe en el log del servidor para
// diagnosticar; no se guarda en la base ni llega al navegador.
export class AiProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail?: string,
  ) {
    super(code);
  }
}
