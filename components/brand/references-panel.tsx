"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, Input, Notice, useToast } from "@/components/ui";
import { errorMessage } from "@/lib/errors";

interface Ref {
  id: string;
  label: string;
  width: number;
  height: number;
}

// Referencias visuales de la marca: lo único que el brief de diseño pide usar
// como referencia (por ejemplo, carruseles que a la marca ya le gustan).
export function ReferencesPanel({ slug, initial, canEdit }: { slug: string; initial: Ref[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [refs, setRefs] = useState(initial);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/w/${slug}/brand/references`;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setPending(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set("file", file);
      form.set("label", label);
      const response = await fetch(base, { method: "POST", body: form }).catch(() => null);
      const data = response ? await response.json().catch(() => ({})) : {};
      if (!response?.ok) {
        setError(errorMessage(data.error));
        break;
      }
      setRefs((prev) => [...prev, data.reference as Ref]);
    }
    setPending(false);
    setLabel("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    const response = await fetch(`${base}/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) return toast.error("No se pudo quitar la referencia.");
    setRefs((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-small font-medium text-ink">Referencias visuales</h2>
        <p className="mt-0.5 text-caption text-ink-2">Imágenes que muestran el estilo de la marca (por ejemplo, carruseles que ya les gustan). El brief de diseño de cada pieza pide usar solo estas como referencia. Hasta 12.</p>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {refs.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {refs.map((r) => (
            <li key={r.id} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/${r.id}`} alt={r.label || "Referencia de la marca"} className="aspect-[4/5] w-full rounded-[10px] bg-pearl object-cover shadow-raised" />
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-caption text-ink-2">{r.label || `${r.width}×${r.height}`}</span>
                {canEdit ? (
                  <button type="button" onClick={() => remove(r.id)} className="text-caption font-medium text-danger hover:underline">
                    Quitar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-2">Todavía no hay referencias.</p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="ref-label" className="mb-1 block text-caption text-ink-2">
              Nota (opcional)
            </label>
            <Input id="ref-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Por ejemplo: carrusel de octubre, el tono que buscamos" />
          </div>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" id="ref-file" onChange={(e) => void upload(e.target.files)} />
          <Button variant="secondary" loading={pending} onClick={() => input.current?.click()}>
            Subir imágenes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
