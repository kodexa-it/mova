"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Modal, Notice, useConfirm, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

const FIELDS = [
  ["reach", "Alcance (cuentas)"],
  ["saves", "Guardados"],
  ["shares", "Compartidos"],
  ["profileVisits", "Visitas al perfil"],
  ["inquiries", "Consultas comerciales"],
  ["likes", "Me gusta"],
  ["comments", "Comentarios"],
  ["plays", "Reproducciones"],
] as const;

// Cargar métricas a mano (desde las estadísticas de Instagram) o leer las
// públicas con Apify (pago, con confirmación).
export function PublicationActions({ slug, publicationId, apify, canWrite }: { slug: string; publicationId: string; apify: boolean; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"manual" | "apify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canWrite) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, number | null> = {};
    for (const [key] of FIELDS) {
      const raw = String(form.get(key) ?? "").replace(/\./g, "").trim();
      body[key] = raw === "" ? null : Number(raw);
      if (raw !== "" && (!Number.isInteger(body[key]) || body[key]! < 0)) return setError("Usá números enteros.");
    }
    setPending("manual");
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/publications/${publicationId}/metrics`, { method: "POST", body });
    setPending(null);
    if (!result.ok) return setError(result.message);
    setOpen(false);
    toast.success("Métricas guardadas");
    router.refresh();
  }

  async function readPublic() {
    const ok = await confirm({
      title: "¿Leer las métricas públicas con Apify?",
      description: "Lee me gusta, comentarios y reproducciones de la publicación. Cuesta cerca de USD 0,0027 por lectura (tope de USD 0,01).",
      confirmLabel: "Leer métricas",
    });
    if (!ok) return;
    setPending("apify");
    const result = await apiRequest(`/api/w/${slug}/publications/${publicationId}/metrics/public`, { method: "POST", body: { confirm: true } });
    setPending(null);
    if (!result.ok) return toast.error(result.message);
    toast.success("Métricas públicas actualizadas");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {dialog}
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Cargar métricas
      </Button>
      {apify ? (
        <Button size="sm" variant="quiet" onClick={readPublic} loading={pending === "apify"} disabled={pending !== null}>
          Leer públicas
        </Button>
      ) : null}
      <Modal open={open} onOpenChange={setOpen} title="Cargar métricas" description="Copialas de las estadísticas de la publicación en Instagram. Dejá vacío lo que no tengas.">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <Field key={key} id={`m-${key}`} label={label}>
                <Input id={`m-${key}`} name={key} inputMode="numeric" />
              </Field>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending === "manual"}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
