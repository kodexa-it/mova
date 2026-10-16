"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

// Mejora la composición de las imágenes sin tocar ningún texto. Con IA elige
// del catálogo cerrado; la sugerencia automática aplica reglas fijas, sin costo.
// Si la IA no está disponible o falla, se ofrece la automática.
export function ComposePanel({ slug, itemId, aiEnabled, dirty }: { slug: string; itemId: string; aiEnabled: boolean; dirty: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<"ai" | "auto" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compose(mode: "ai" | "auto") {
    setPending(mode);
    setError(null);
    const result = await apiRequest<{ changed: boolean; version?: { number: number }; replaced: number }>(`/api/w/${slug}/content/${itemId}/compose`, { method: "POST", body: { mode } });
    setPending(null);
    if (!result.ok) return setError(result.message);
    const note = result.data.replaced ? `${result.data.replaced} elección(es) de la IA no cumplían las reglas y se usó la sugerencia automática.` : undefined;
    toast.success(result.data.changed ? `Composición nueva en la versión ${result.data.version?.number}` : "La composición ya era esa", note);
    router.refresh();
  }

  return (
    <div className="flex flex-col rounded-[14px] bg-surface p-4 shadow-raised">
      <p className="flex items-center gap-2 text-small font-medium text-ink">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <rect x="2.5" y="2.5" width="4.5" height="5.5" rx="1" />
          <rect x="9" y="2.5" width="4.5" height="3.5" rx="1" />
          <rect x="2.5" y="10" width="4.5" height="3.5" rx="1" />
          <rect x="9" y="8" width="4.5" height="5.5" rx="1" />
        </svg>
        Composición de las imágenes
      </p>
      <p className="mt-1 text-caption text-ink-2">Elige cómo se arma cada imagen. No toca textos ni caption.</p>
      {error ? (
        <div className="mt-3 flex flex-col gap-2">
          <Notice tone="error">{error}</Notice>
          <div>
            <Button size="sm" variant="secondary" onClick={() => compose("auto")} loading={pending === "auto"} disabled={pending !== null || dirty}>
              Usar la sugerencia automática (sin costo)
            </Button>
          </div>
        </div>
      ) : null}
      {dirty ? <p className="mt-2 text-caption text-warning">Guardá tus cambios antes: la composición se guarda como una versión nueva.</p> : null}
      {!error ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {aiEnabled ? (
            <Button size="sm" onClick={() => compose("ai")} loading={pending === "ai"} disabled={pending !== null || dirty}>
              {pending === "ai" ? "Eligiendo" : "Mejorar composición"}
            </Button>
          ) : null}
          <Button size="sm" variant={aiEnabled ? "quiet" : "secondary"} onClick={() => compose("auto")} loading={pending === "auto"} disabled={pending !== null || dirty}>
            Sugerencia automática (sin costo)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
