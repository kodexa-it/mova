"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { calendarHref, type CalendarState } from "@/components/calendar/calendar-url";
import { Select, Spinner } from "@/components/ui";
import { FORMAT_LABELS, FORMATS } from "@/modules/content/formats";
import { STATUS_LABELS } from "@/modules/content/status";

const STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "ARCHIVED"] as const;

// Filtros del calendario. Cambian la URL; la página se vuelve a renderizar en el servidor.
export function CalendarFilters({ slug, state, pillars }: { slug: string; state: CalendarState; pillars: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (patch: Partial<CalendarState>) => start(() => router.push(calendarHref(slug, state, patch), { scroll: false }));
  const active = Boolean(state.format || state.status || state.pillar);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
      <label className="sr-only" htmlFor="f-format">
        Formato
      </label>
      <Select id="f-format" controlSize="sm" value={state.format ?? ""} onChange={(e) => go({ format: e.target.value || undefined })}>
        <option value="">Todos los formatos</option>
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABELS[f]}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="f-status">
        Estado
      </label>
      <Select id="f-status" controlSize="sm" value={state.status ?? ""} onChange={(e) => go({ status: e.target.value || undefined })}>
        <option value="">Todos los estados</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {pillars.length ? (
        <>
          <label className="sr-only" htmlFor="f-pillar">
            Pilar
          </label>
          <Select id="f-pillar" controlSize="sm" value={state.pillar ?? ""} onChange={(e) => go({ pillar: e.target.value || undefined })} className="max-w-[12rem]">
            <option value="">Todos los pilares</option>
            {pillars.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </>
      ) : null}
      {active ? (
        <button
          type="button"
          onClick={() => go({ format: undefined, status: undefined, pillar: undefined })}
          className="h-8 rounded-[9px] px-2 text-small text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Quitar filtros
        </button>
      ) : null}
      {pending ? <Spinner className="size-4 text-ink-2" /> : null}
    </div>
  );
}
