"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Registro manual de la publicación: cuándo y con qué enlace se publicó la
// versión aprobada. Descargar o exportar no cuenta como publicar.
export function PublicationPanel({
  slug,
  itemId,
  publication,
  canRecord,
  approved,
}: {
  slug: string;
  itemId: string;
  publication: { publishedAt: string; permalink: string } | null;
  canRecord: boolean;
  approved: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (publication) {
    return (
      <div className="rounded-[12px] bg-pearl px-4 py-3">
        <p className="text-small font-semibold text-ink">Publicada</p>
        <p className="mt-0.5 text-caption text-ink-2">
          {new Date(publication.publishedAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
          <a href={publication.permalink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            ver en Instagram
          </a>
        </p>
        <Link href={`/w/${slug}/resultados`} className="mt-1.5 inline-block text-caption font-medium text-accent hover:underline">
          Cargar o ver métricas
        </Link>
      </div>
    );
  }
  if (!approved || !canRecord) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const local = String(form.get("publishedAt") ?? "");
    setPending(true);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/content/${itemId}/publication`, {
      method: "POST",
      body: { publishedAt: new Date(local).toISOString(), permalink: String(form.get("permalink") ?? "") },
    });
    setPending(false);
    if (!result.ok) return setError(result.message);
    toast.success("Publicación registrada", "Ya podés cargar sus métricas en Resultados.");
    router.refresh();
  }

  return (
    <div className="rounded-[12px] border border-line px-4 py-3">
      <p className="text-small font-medium text-ink">¿Ya la publicaste?</p>
      <p className="mt-0.5 text-caption text-ink-2">Registrá la fecha y el enlace para medir sus resultados. Se registra esta versión aprobada.</p>
      {!open ? (
        <Button size="sm" variant="secondary" className="mt-2" onClick={() => setOpen(true)}>
          Registrar publicación
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3" noValidate>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field id="pub-at" label="Fecha y hora de publicación">
            <Input id="pub-at" name="publishedAt" type="datetime-local" defaultValue={nowLocal()} max={nowLocal()} required />
          </Field>
          <Field id="pub-link" label="Enlace de la publicación" hint="instagram.com/p/… o instagram.com/reel/…">
            <Input id="pub-link" name="permalink" type="url" required placeholder="https://www.instagram.com/p/…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="quiet" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Registrar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
