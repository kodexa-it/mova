"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormatIcon } from "@/components/content/format-icon";
import { MODE_COPY, Switch } from "@/components/content/visual-mode";
import { Button, Field, Input, Modal, Notice, Select, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import { FORMAT_HINTS, FORMAT_LABELS, FORMATS, type Format } from "@/modules/content/formats";

// Botón y diálogo para crear una pieza. Desde el calendario llega con el día ya
// elegido (compact: un "+" discreto dentro de la columna del día).
export function NewContentButton({
  slug,
  pillars,
  goals,
  defaultDate,
  compact = false,
  dayLabel,
}: {
  slug: string;
  pillars: string[];
  goals: string[];
  defaultDate?: string;
  compact?: boolean;
  dayLabel?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("CAROUSEL");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [aiVisual, setAiVisual] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await apiRequest<{ item: { id: string } }>(`/api/w/${slug}/content`, {
      method: "POST",
      body: {
        format,
        title: String(form.get("title") ?? ""),
        pillar: String(form.get("pillar") ?? "") || null,
        goal: String(form.get("goal") ?? "") || null,
        date: String(form.get("date") ?? "") || null,
        time: String(form.get("time") ?? "") || undefined,
        visualMode: aiVisual ? "AI" : "STANDARD",
      },
    });
    if (!result.ok) {
      setPending(false);
      return setError(result.message);
    }
    toast.success("Pieza creada");
    router.push(`/w/${slug}/contenido/${result.data.item.id}`);
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={dayLabel ? `Nueva pieza para el ${dayLabel}` : "Nueva pieza"}
          className="flex h-8 w-full items-center justify-center rounded-[9px] text-ink-3 transition-[background-color,color] duration-[var(--dur-fast)] hover:bg-ink/[0.05] hover:text-ink-2 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          Nueva pieza
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Nueva pieza" description="Elegí el formato. Después la escribís o, en el próximo paso, la pedís a Mova." size="lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Notice tone="error">{error}</Notice> : null}
          <fieldset>
            <legend className="mb-2 text-small font-medium text-ink">Formato</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <label
                  key={f}
                  className={`flex cursor-pointer gap-3 rounded-[12px] p-3.5 transition-[background-color,box-shadow] duration-[var(--dur-fast)] has-focus-visible:shadow-[var(--focus-ring)] ${
                    format === f ? "bg-surface shadow-[0_0_0_1.5px_var(--color-accent),0_1px_2px_rgb(20_20_25/0.06)]" : "bg-pearl/70 hover:bg-pearl"
                  }`}
                >
                  <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] ${format === f ? "bg-accent text-white" : "bg-surface text-ink-2"}`}>
                    <FormatIcon format={f} />
                  </span>
                  <span>
                    <span className="block text-small font-medium text-ink">{FORMAT_LABELS[f]}</span>
                    <span className="mt-0.5 block text-caption text-ink-2">{FORMAT_HINTS[f]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="title" label="Nombre de trabajo" hint="Para encontrarla en el calendario. No se publica.">
            <Input id="title" name="title" required maxLength={120} placeholder="Por ejemplo: 3 errores al cotizar" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pillar" label="Pilar">
              <Select id="pillar" name="pillar" defaultValue="">
                <option value="">Sin pilar</option>
                {pillars.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="goal" label="Objetivo">
              <Select id="goal" name="goal" defaultValue="">
                <option value="">Sin objetivo</option>
                {goals.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="date" label="Fecha prevista" hint="Opcional. Con fecha, aparece en el calendario.">
              <Input id="date" name="date" type="date" defaultValue={defaultDate ?? ""} />
            </Field>
            <Field id="time" label="Hora">
              <Input id="time" name="time" type="time" defaultValue="10:00" step={300} />
            </Field>
          </div>
          <div className="rounded-[12px] bg-pearl/70 p-3.5">
            <Switch id="new-visual-mode" checked={aiVisual} onChange={setAiVisual} label="Generación visual con IA" />
            <p className="mt-1.5 text-caption text-ink-2">{aiVisual ? MODE_COPY.ai : MODE_COPY.standard}</p>
            <p className="mt-1 text-caption text-ink-2">Activarlo no genera ninguna imagen: cada una se pide y se confirma después, en el editor. Se puede cambiar en cualquier momento.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Crear pieza
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
