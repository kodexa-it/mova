"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Notice, Textarea, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

// Foco de la semana: una o dos frases que orientan qué se publica y para qué.
export function PlanFocus({ slug, weekStart, initial, canEdit }: { slug: string; weekStart: string; initial: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== saved.trim();

  if (!canEdit) {
    return <p className="text-body text-ink">{initial || <span className="text-ink-2">Sin foco definido para esta semana.</span>}</p>;
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ plan: { focus: string } }>(`/api/w/${slug}/plans/${weekStart}`, { method: "PUT", body: { focus: value } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    setSaved(result.data.plan.focus);
    setValue(result.data.plan.focus);
    toast.success("Foco de la semana guardado");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <label htmlFor={`focus-${weekStart}`} className="sr-only">
        Foco de la semana
      </label>
      <Textarea
        id={`focus-${weekStart}`}
        value={value}
        maxLength={400}
        rows={3}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) void save();
        }}
        placeholder="Por ejemplo: mostrar casos reales de clientes y abrir consultas para el servicio de mantenimiento."
        className="min-h-0! resize-none! [field-sizing:content] max-h-48"
      />
      {dirty ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="quiet" size="sm" onClick={() => setValue(saved)} disabled={pending}>
            Descartar
          </Button>
          <Button size="sm" onClick={save} loading={pending}>
            Guardar foco
          </Button>
        </div>
      ) : null}
    </div>
  );
}
