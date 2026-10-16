"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FormatIcon } from "@/components/content/format-icon";
import { MODE_COPY, Switch } from "@/components/content/visual-mode";
import { Button, Input, Notice, Select, Spinner, Textarea, useConfirm, useToast } from "@/components/ui";
import { apiRequest } from "@/lib/errors";
import { addDays, dayNumber, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import { FORMAT_LABELS, FORMATS, type Format } from "@/modules/content/formats";
import { STATUS_LABELS } from "@/modules/content/status";
import type { StrategySlot } from "@/modules/plans/strategy-model";

type Status = "NONE" | "PROPOSED" | "APPROVED";

const shortDay = (ymd: string) => `${WEEKDAYS_SHORT[weekdayOf(ymd) - 1]} ${dayNumber(ymd)}`;

export interface StrategyState {
  status: Status;
  focus: string;
  strategy: { summary: string; slots: StrategySlot[] } | null;
  progress: {
    total: number;
    queued: number;
    done: number;
    failed: number;
    items: { id: string; job: string; error: string | null; item: { id: string; title: string; format: Format; status: keyof typeof STATUS_LABELS } | null }[];
  } | null;
}

// Estrategia semanal con IA: la propuesta a partir del foco, su edición, la
// aprobación (que crea las piezas y las genera en segundo plano) y el avance.
export function StrategyPanel({
  slug,
  weekStart,
  today,
  initial,
  canPlan,
  aiEnabled,
  pillars,
  goals,
}: {
  slug: string;
  weekStart: string;
  today: string;
  initial: StrategyState;
  canPlan: boolean;
  aiEnabled: boolean;
  pillars: string[];
  goals: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [state, setState] = useState(initial);
  const [slots, setSlots] = useState<StrategySlot[]>(initial.strategy?.slots ?? []);
  const [count, setCount] = useState(4);
  const [instructions, setInstructions] = useState("");
  const [aiVisual, setAiVisual] = useState(false);
  const [pending, setPending] = useState<"propose" | "save" | "approve" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/w/${slug}/plans/${weekStart}/strategy`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d >= today);
  const dirty = JSON.stringify(slots) !== JSON.stringify(state.strategy?.slots ?? []);

  const reload = useCallback(async () => {
    const result = await apiRequest<StrategyState>(base);
    if (result.ok) {
      setState(result.data);
      setSlots(result.data.strategy?.slots ?? []);
    }
    return result;
  }, [base]);

  // Mientras se generan las piezas, consulta el avance cada pocos segundos.
  const running = state.status === "APPROVED" && (state.progress?.queued ?? 0) > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const result = await reload();
      if (result.ok && !result.data.progress?.queued) router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [running, reload, router]);

  async function propose() {
    setPending("propose");
    setError(null);
    const result = await apiRequest<{ dropped: number }>(base, { method: "POST", body: { count, instructions } });
    setPending(null);
    if (!result.ok) return setError(result.message);
    await reload();
    toast.success("Propuesta lista", result.data.dropped ? `${result.data.dropped} idea(s) de la IA no cumplían las reglas y se descartaron.` : "Revisala, ajustala y aprobala.");
  }

  async function save() {
    setPending("save");
    setError(null);
    const result = await apiRequest(base, { method: "PUT", body: { summary: state.strategy?.summary ?? "", slots } });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    await reload();
    return true;
  }

  async function approve() {
    const ok = await confirm({
      title: `¿Aprobar la estrategia y generar ${slots.length} ${slots.length === 1 ? "pieza" : "piezas"}?`,
      description: `Mova crea las piezas con su fecha y escribe cada una en segundo plano (usa el presupuesto de IA). Las que pasen la revisión automática quedan en revisión y se avisa a Aprobadores y Dueños. Nada se publica sin aprobación.${aiVisual ? " Las imágenes con IA no se generan solas: cada una se pide y se confirma en el editor." : ""}`,
      confirmLabel: "Aprobar y generar",
    });
    if (!ok) return;
    if (dirty && !(await save())) return;
    setPending("approve");
    setError(null);
    const result = await apiRequest(`${base}/approve`, { method: "POST", body: { visualMode: aiVisual ? "AI" : "STANDARD" } });
    setPending(null);
    if (!result.ok) return setError(result.message);
    toast.success("Estrategia aprobada", "Las piezas se están generando. Te avisamos cuando estén.");
    await reload();
    router.refresh();
  }

  async function discard() {
    setPending("discard");
    const result = await apiRequest(base, { method: "DELETE" });
    setPending(null);
    if (!result.ok) return setError(result.message);
    await reload();
  }

  const set = (i: number, patch: Partial<StrategySlot>) => setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  if (state.status === "APPROVED") {
    const p = state.progress;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-small font-medium text-ink">Estrategia aprobada</p>
          {p ? (
            <p className="flex items-center gap-2 text-caption text-ink-2" aria-live="polite">
              {p.queued ? <Spinner className="size-3.5" /> : null}
              {p.queued ? `Generando: ${p.done + p.failed} de ${p.total}` : `${p.done} de ${p.total} generadas${p.failed ? ` · ${p.failed} con error` : ""}`}
            </p>
          ) : null}
        </div>
        {state.strategy?.summary ? <p className="text-small text-ink-2">{state.strategy.summary}</p> : null}
        <ul className="flex flex-col gap-1.5">
          {p?.items.map((row) => (
            <li key={row.id} className="flex items-center gap-2.5 rounded-[10px] bg-surface px-3 py-2 shadow-raised">
              {row.item ? <FormatIcon format={row.item.format} /> : null}
              <span className="min-w-0 flex-1 truncate text-small text-ink">
                {row.item ? (
                  <Link href={`/w/${slug}/contenido/${row.id}`} className="hover:underline">
                    {row.item.title}
                  </Link>
                ) : (
                  "Pieza eliminada"
                )}
              </span>
              <span className={`text-caption ${row.job === "FAILED" ? "text-danger" : "text-ink-2"}`}>
                {row.job === "QUEUED" || row.job === "RUNNING" ? "Generando…" : row.job === "FAILED" ? "No se pudo generar" : row.item ? STATUS_LABELS[row.item.status] : ""}
              </span>
            </li>
          ))}
        </ul>
        {p?.failed ? <p className="text-caption text-ink-2">Las que no se pudieron generar quedaron como borrador: abrilas y pedí la propuesta a Mova desde el editor.</p> : null}
      </div>
    );
  }

  if (!canPlan) {
    return state.status === "PROPOSED" ? <p className="text-small text-ink-2">Hay una propuesta de Mova para esta semana esperando aprobación.</p> : null;
  }

  if (state.status === "NONE") {
    const noFocus = !state.focus.trim();
    return (
      <div className="flex flex-col gap-3">
        {dialog}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!aiEnabled ? (
          <p className="text-caption text-ink-2">La IA no está activada en este servidor: armá la semana a mano con «Nueva pieza».</p>
        ) : !days.length ? (
          <p className="text-caption text-ink-2">Esta semana ya pasó.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={`count-${weekStart}`} className="mb-1 block text-caption text-ink-2">
                  Piezas
                </label>
                <Select id={`count-${weekStart}`} controlSize="sm" value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[14rem] flex-1">
                <label htmlFor={`instr-${weekStart}`} className="mb-1 block text-caption text-ink-2">
                  Indicaciones (opcional)
                </label>
                <Input id={`instr-${weekStart}`} value={instructions} maxLength={600} onChange={(e) => setInstructions(e.target.value)} placeholder="Por ejemplo: un Reel el jueves y nada el fin de semana." />
              </div>
              <Button size="sm" onClick={propose} loading={pending === "propose"} disabled={noFocus || pending !== null}>
                {pending === "propose" ? "Pensando la semana" : "Proponer la semana con IA"}
              </Button>
            </div>
            {noFocus ? <p className="text-caption text-ink-2">Guardá primero el foco: Mova arma la estrategia a partir de él.</p> : null}
          </>
        )}
      </div>
    );
  }

  // PROPOSED
  return (
    <div className="flex flex-col gap-3">
      {dialog}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div>
        <p className="text-small font-medium text-ink">Propuesta de Mova</p>
        {state.strategy?.summary ? <p className="mt-0.5 text-small text-ink-2">{state.strategy.summary}</p> : null}
      </div>
      <ol className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <li key={slot.key} className="rounded-[12px] bg-surface p-3 shadow-raised">
            <div className="grid gap-2 sm:grid-cols-[8.5rem_7.5rem_9rem_minmax(0,1fr)_auto] sm:items-center">
              <Select aria-label="Día" controlSize="sm" value={slot.date} onChange={(e) => set(i, { date: e.target.value })}>
                {(days.includes(slot.date) ? days : [slot.date, ...days]).map((d) => (
                  <option key={d} value={d}>
                    {shortDay(d)}
                  </option>
                ))}
              </Select>
              <Input aria-label="Hora" type="time" step={300} className="h-8! rounded-[8px]! text-small!" value={slot.time} onChange={(e) => set(i, { time: e.target.value })} />
              <Select aria-label="Formato" controlSize="sm" value={slot.format} onChange={(e) => set(i, { format: e.target.value as Format })}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </Select>
              <Input aria-label="Tema" className="h-8! rounded-[8px]! text-small!" value={slot.title} maxLength={120} onChange={(e) => set(i, { title: e.target.value })} />
              <Button size="sm" variant="quiet" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))} aria-label={`Quitar «${slot.title}»`} disabled={slots.length <= 1}>
                Quitar
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Select aria-label="Pilar" controlSize="sm" value={slot.pillar ?? ""} onChange={(e) => set(i, { pillar: e.target.value || null })}>
                <option value="">Sin pilar</option>
                {pillars.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              <Select aria-label="Objetivo" controlSize="sm" value={slot.goal ?? ""} onChange={(e) => set(i, { goal: e.target.value || null })}>
                <option value="">Sin objetivo</option>
                {goals.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea aria-label="Ángulo" rows={2} maxLength={400} value={slot.angle} onChange={(e) => set(i, { angle: e.target.value })} className="mt-2 min-h-0! resize-none! text-small!" placeholder="Ángulo concreto de la pieza" />
            {slot.rationale ? <p className="mt-1.5 text-caption text-ink-2">Por qué: {slot.rationale}</p> : null}
          </li>
        ))}
      </ol>
      <div className="rounded-[12px] bg-pearl/70 p-3">
        <Switch id={`strategy-visual-${weekStart}`} checked={aiVisual} onChange={setAiVisual} label="Generación visual con IA en estas piezas" />
        <p className="mt-1 text-caption text-ink-2">{aiVisual ? MODE_COPY.ai : MODE_COPY.standard}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="quiet" onClick={discard} loading={pending === "discard"} disabled={pending !== null}>
          Descartar
        </Button>
        {dirty ? (
          <Button size="sm" variant="secondary" onClick={() => void save()} loading={pending === "save"} disabled={pending !== null}>
            Guardar cambios
          </Button>
        ) : null}
        <Button size="sm" onClick={approve} loading={pending === "approve"} disabled={pending !== null || !slots.length}>
          Aprobar y generar {slots.length} {slots.length === 1 ? "pieza" : "piezas"}
        </Button>
      </div>
    </div>
  );
}
