"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Notice, Textarea, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

export interface GenerationState {
  enabled: boolean;
  reason?: string;
  remaining: number;
  hasContent: boolean;
}

// Pide a Mova una versión de la pieza. El resultado se guarda como una versión
// más (autoría "Mova"): se puede editar, comparar o descartar volviendo a
// escribir. Nunca aprueba ni publica.
export function GeneratePanel({ slug, itemId, state, dirty }: { slug: string; itemId: string; state: GenerationState; dirty: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [instructions, setInstructions] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.enabled) {
    return <p className="rounded-[12px] bg-pearl/60 px-4 py-3 text-small text-ink-2">{state.reason}</p>;
  }

  async function generate() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ version?: { number: number }; remaining: number }>(`/api/w/${slug}/content/${itemId}/generate`, {
      method: "POST",
      body: { instructions },
    });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setInstructions("");
    toast.success(result.data.version ? `Mova escribió la versión ${result.data.version.number}` : "La propuesta es igual a la versión actual", `Quedan ${result.data.remaining} propuestas para esta pieza.`);
    router.refresh();
  }

  return (
    <div className="rounded-[14px] bg-[linear-gradient(135deg,rgb(238_238_252/0.9),rgb(242_241_238/0.7))] p-4 shadow-[inset_0_0_0_1px_rgb(61_58_216/0.12)]">
      <label htmlFor="gen-instructions" className="flex items-center gap-2 text-small font-medium text-ink">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3L8 2.5Z" />
        </svg>
        {state.hasContent ? "Pedile a Mova que la mejore" : "Pedile a Mova un primer borrador"}
      </label>
      <Textarea
        id="gen-instructions"
        className="mt-2 min-h-[3.75rem] bg-surface" rows={2}
        maxLength={800}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder={state.hasContent ? "Por ejemplo: más corto, con un ejemplo de un estudio contable." : "Opcional: el ángulo, un ejemplo o lo que tiene que decir."}
      />
      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {dirty ? <p className="mt-2 text-caption text-warning">Guardá tus cambios antes: la propuesta se guarda como una versión nueva.</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-ink-2">
          {state.remaining} de 5 propuestas disponibles. Cada una consume presupuesto de IA.
        </p>
        <Button size="sm" onClick={generate} loading={pending} disabled={dirty || state.remaining <= 0}>
          {pending ? "Escribiendo" : state.hasContent ? "Mejorar" : "Escribir borrador"}
        </Button>
      </div>
    </div>
  );
}
