"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, Field, Input, Modal, Notice, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";

// Fecha prevista de publicación de una pieza, en la zona horaria de la marca.
export function ScheduleControl({
  slug,
  itemId,
  date,
  time,
  label,
  canEdit,
  locked = false,
}: {
  slug: string;
  itemId: string;
  date: string | null;
  time: string | null;
  label: string | null;
  canEdit: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(body: { date: string | null; time?: string }, kind: "save" | "clear") {
    setPending(kind);
    setError(null);
    const result = await apiRequest(`/api/w/${slug}/content/${itemId}/schedule`, { method: "PUT", body });
    setPending(null);
    if (!result.ok) return setError(result.message);
    setOpen(false);
    toast.success(body.date ? "Fecha guardada" : "Fecha quitada");
    router.refresh();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextDate = String(form.get("date") ?? "");
    if (!nextDate) return setError("Elegí una fecha.");
    void send({ date: nextDate, time: String(form.get("time") ?? "") || undefined }, "save");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.75" y="3.5" width="10.5" height="9.75" rx="2" />
          <path d="M2.75 6.5h10.5M5.5 2.25v2.5M10.5 2.25v2.5" />
        </svg>
        {label ? <span className="text-ink">{label}</span> : <span>Sin fecha prevista</span>}
      </span>
      {date ? (
        <Link href={`/w/${slug}/calendario?vista=semana&fecha=${date}`} className="text-accent underline-offset-4 hover:underline">
          Ver en el calendario
        </Link>
      ) : null}
      {canEdit && !locked ? (
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-accent underline-offset-4 hover:underline">
          {date ? "Cambiar fecha" : "Ponerle fecha"}
        </button>
      ) : null}

      <Modal open={open} onOpenChange={setOpen} title="Fecha prevista" description="El día y la hora en que se piensa publicar, en la zona horaria del público de la marca.">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="schedule-date" label="Fecha">
              <Input id="schedule-date" name="date" type="date" defaultValue={date ?? ""} required />
            </Field>
            <Field id="schedule-time" label="Hora">
              <Input id="schedule-time" name="time" type="time" step={300} defaultValue={time ?? "10:00"} required />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {date ? (
              <Button type="button" variant="quiet" onClick={() => send({ date: null }, "clear")} loading={pending === "clear"} disabled={pending !== null}>
                Quitar fecha
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending === "save"} disabled={pending !== null}>
                Guardar fecha
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
