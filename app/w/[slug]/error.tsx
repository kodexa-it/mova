"use client";

import { Button } from "@/components/ui";

// Error inesperado dentro de un workspace. Los errores esperados (sin permiso,
// datos inválidos) se muestran en su lugar; esto es solo para fallas.
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-surface p-8 shadow-raised">
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger">
        <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 5v3.5M8 10.75h.01M14.25 8a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />
        </svg>
      </span>
      <div>
        <h1 className="text-title font-semibold text-ink">No pudimos cargar esta sección</h1>
        <p className="mt-1.5 max-w-md text-body text-ink-2">
          Puede ser una falla momentánea de conexión con el servidor. Probá de nuevo; si sigue pasando, avisanos.
        </p>
      </div>
      <Button variant="secondary" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
