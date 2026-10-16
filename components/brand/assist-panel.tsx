"use client";

import { useState, type ReactNode } from "react";

import { Button, Notice, Textarea } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import type { SectionKey } from "@/modules/brand/sections";

// Asistente de una sección: pide una propuesta a la IA y la muestra para que la
// persona la use o la descarte. Nunca guarda: usar la propuesta solo completa el
// formulario, y hay que tocar "Guardar".
export function AssistPanel<T>({
  slug,
  section,
  enabled,
  onApply,
  renderPreview,
}: {
  slug: string;
  section: SectionKey;
  enabled: boolean;
  onApply: (proposal: T) => void;
  renderPreview: (proposal: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<T | null>(null);

  if (!enabled) {
    return (
      <p className="flex items-center gap-2 rounded-[12px] bg-pearl/60 px-4 py-3 text-small text-ink-2">
        <Spark className="text-ink-3" />
        El asistente de IA se activa cuando el servidor tiene configurada una clave de IA.
      </p>
    );
  }

  async function ask() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ proposal: T }>(`/api/w/${slug}/brand/${section}/assist`, { method: "POST", body: { notes } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setProposal(result.data.proposal);
  }

  return (
    <div className="rounded-[14px] bg-[linear-gradient(135deg,rgb(238_238_252/0.9),rgb(242_241_238/0.7))] p-4 shadow-[inset_0_0_0_1px_rgb(61_58_216/0.12)]">
      {!open && !proposal ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-small text-ink">
            <Spark className="text-accent" />
            Mova puede proponer esta sección a partir de lo que ya cargaste.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Proponer con IA
          </Button>
        </div>
      ) : null}

      {open && !proposal ? (
        <div className="flex flex-col gap-3">
          <label htmlFor={`assist-${section}`} className="flex items-center gap-2 text-small font-medium text-ink">
            <Spark className="text-accent" />
            ¿Algo que Mova tenga que saber? <span className="font-normal text-ink-2">Opcional.</span>
          </label>
          <Textarea id={`assist-${section}`} className="min-h-16 bg-surface" maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Por ejemplo: nos enfocamos en estudios contables de Córdoba." />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={pending} onClick={ask}>
              {pending ? "Pensando" : "Proponer"}
            </Button>
            <Button type="button" size="sm" variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {proposal ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-small font-medium text-ink">
            <Spark className="text-accent" />
            Propuesta de Mova
          </p>
          <div className="animate-rise-in rounded-[10px] bg-surface p-4 text-small text-ink shadow-raised">{renderPreview(proposal)}</div>
          <p className="text-caption text-ink-2">Revisala antes de usarla. Al usarla se completa el formulario; no se guarda hasta que toques Guardar.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(proposal);
                setProposal(null);
                setOpen(false);
              }}
            >
              Usar propuesta
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setProposal(null)}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3L8 2.5Z" />
    </svg>
  );
}
