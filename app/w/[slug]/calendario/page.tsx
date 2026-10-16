import type { Metadata } from "next";
import Link from "next/link";

import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { calendarHref, type CalendarState } from "@/components/calendar/calendar-url";
import { PlanFocus } from "@/components/calendar/plan-focus";
import { StrategyPanel, type StrategyState } from "@/components/calendar/strategy-panel";
import { StatusDot } from "@/components/calendar/status-dot";
import { FormatIcon } from "@/components/content/format-icon";
import { NewContentButton } from "@/components/content/new-content";
import { Card, PageHeader } from "@/components/ui";
import { requirePageWorkspace } from "@/lib/page-context";
import { addDays, addMonths, dayLabel, dayNumber, isYmd, monthLabel, monthStartOf, monthWeeks, todayIn, weekLabel, WEEKDAYS_SHORT, weekStartOf } from "@/lib/time";
import { can } from "@/modules/access/permissions";
import { getBrand } from "@/modules/brand/service";
import { FORMAT_LABELS, FORMATS, type Format } from "@/modules/content/formats";
import { CONTENT_STATUSES } from "@/modules/plans/schemas";
import { getProvider } from "@/modules/ai/providers/registry";
import { getCalendar, getCalendarZone, listUnscheduled, type CalendarItem } from "@/modules/plans/service";
import { getStrategy } from "@/modules/plans/strategy";

export const metadata: Metadata = { title: "Calendario" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function readState(search: Search, today: string): CalendarState {
  const fecha = one(search.fecha);
  const formato = one(search.formato);
  const estado = one(search.estado);
  const pilar = one(search.pilar)?.slice(0, 60);
  return {
    view: one(search.vista) === "mes" ? "mes" : "semana",
    date: fecha && isYmd(fecha) ? fecha : today,
    format: formato && (FORMATS as readonly string[]).includes(formato) ? formato : undefined,
    status: estado && (CONTENT_STATUSES as readonly string[]).includes(estado) ? estado : undefined,
    pillar: pilar || undefined,
  };
}

function groupByDay(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
  return map;
}

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const ctx = await requirePageWorkspace(slug);
  const timezone = await getCalendarZone(ctx);
  const today = todayIn(timezone);
  const state = readState(await searchParams, today);
  const canPlan = can(ctx.role, "plan.write");

  const weekStart = weekStartOf(state.date);
  const weeks = state.view === "mes" ? monthWeeks(state.date) : [weekStart];
  const from = weeks[0]!;
  const to = addDays(weeks.at(-1)!, 7);

  const [calendar, brand, unscheduled, strategy] = await Promise.all([
    getCalendar(ctx, { from, to, format: state.format as Format | undefined, status: state.status as CalendarItem["status"] | undefined, pillar: state.pillar }),
    getBrand(ctx),
    state.view === "semana" ? listUnscheduled(ctx) : Promise.resolve([]),
    state.view === "semana" ? getStrategy(ctx, weekStart) : Promise.resolve(null),
  ]);
  const byDay = groupByDay(calendar.items);
  const pillars = brand?.pillars.map((p) => p.name) ?? [];
  const goals = brand?.goals.map((g) => g.title) ?? [];

  const step = state.view === "mes" ? (n: number) => addMonths(monthStartOf(state.date), n) : (n: number) => addDays(weekStart, 7 * n);
  const title = state.view === "mes" ? monthLabel(state.date) : weekLabel(weekStart);
  const isCurrent = state.view === "mes" ? monthStartOf(today) === monthStartOf(state.date) : weekStartOf(today) === weekStart;
  const plan = calendar.plans.find((p) => p.weekStart === weekStart);
  const filtered = Boolean(state.format || state.status || state.pillar);

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Lo que la marca publica cada semana, con el estado de cada pieza. Las horas están en la zona horaria del público de la marca."
        actions={canPlan ? <NewContentButton slug={slug} pillars={pillars} goals={goals} defaultDate={state.view === "semana" && !isCurrent ? weekStart : today} /> : null}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[10px] bg-surface shadow-raised">
            <Link href={calendarHref(slug, state, { date: step(-1) })} aria-label={state.view === "mes" ? "Mes anterior" : "Semana anterior"} className="grid size-9 place-items-center rounded-l-[10px] text-ink-2 transition-colors hover:bg-pearl hover:text-ink">
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9.75 4-4 4 4 4" />
              </svg>
            </Link>
            <span aria-hidden className="h-5 w-px bg-line" />
            <Link href={calendarHref(slug, state, { date: step(1) })} aria-label={state.view === "mes" ? "Mes siguiente" : "Semana siguiente"} className="grid size-9 place-items-center rounded-r-[10px] text-ink-2 transition-colors hover:bg-pearl hover:text-ink">
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6.25 4 4 4-4 4" />
              </svg>
            </Link>
          </div>
          {!isCurrent ? (
            <Link href={calendarHref(slug, state, { date: today })} className="h-9 rounded-[10px] px-3 text-small font-medium leading-9 text-ink-2 transition-colors hover:bg-ink/[0.04] hover:text-ink">
              Hoy
            </Link>
          ) : null}
          <h2 className="ml-1 text-lead font-semibold text-ink" aria-live="polite">
            {title}
          </h2>
        </div>
        <nav aria-label="Vista" className="flex rounded-[10px] bg-pearl p-0.5">
          {(["semana", "mes"] as const).map((view) => (
            <Link
              key={view}
              href={calendarHref(slug, state, { view })}
              aria-current={state.view === view ? "page" : undefined}
              className={`h-8 rounded-[8px] px-3.5 text-small leading-8 transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ${state.view === view ? "bg-surface font-medium text-ink shadow-raised" : "text-ink-2 hover:text-ink"}`}
            >
              {view === "semana" ? "Semana" : "Mes"}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-5">
        <CalendarFilters slug={slug} state={state} pillars={pillars} />
      </div>

      {state.view === "semana" ? (
        <>
          <Card className="mb-5 p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-small font-medium text-ink">Foco de la semana</h3>
              <WeekSummary items={calendar.items} filtered={filtered} />
            </div>
            <PlanFocus key={weekStart} slug={slug} weekStart={weekStart} initial={plan?.focus ?? ""} canEdit={canPlan} />
            {strategy ? (
              <div className="mt-4 border-t border-line pt-4">
                <StrategyPanel
                  key={`${weekStart}-${strategy.status}-${plan?.focus ?? ""}`}
                  slug={slug}
                  weekStart={weekStart}
                  today={today}
                  initial={JSON.parse(JSON.stringify(strategy)) as StrategyState}
                  canPlan={canPlan}
                  aiEnabled={getProvider() !== null}
                  pillars={pillars}
                  goals={goals}
                />
              </div>
            ) : null}
          </Card>

          <ol className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-2">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day, i) => {
              const items = byDay.get(day) ?? [];
              const isToday = day === today;
              return (
                <li key={day} className={`flex min-w-0 flex-col rounded-[14px] p-2 md:min-h-[17rem] ${isToday ? "bg-accent-soft/60" : "bg-pearl/55"}`}>
                  <h3 className="mb-2 flex items-baseline gap-1.5 px-1 pt-0.5">
                    <span className="sr-only">{dayLabel(day)}</span>
                    <span aria-hidden className="text-caption text-ink-2">
                      {WEEKDAYS_SHORT[i]}
                    </span>
                    <span aria-hidden className={`tabular text-small font-semibold ${isToday ? "text-accent" : "text-ink"}`}>
                      {dayNumber(day)}
                    </span>
                    {isToday ? <span className="ml-auto text-caption font-medium text-accent">Hoy</span> : null}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <li key={item.id}>
                        <PieceCard slug={slug} item={item} />
                      </li>
                    ))}
                  </ul>
                  {items.length === 0 && !canPlan ? <p className="px-1 text-caption text-ink-3 md:hidden">Sin piezas</p> : null}
                  {canPlan ? (
                    <div className="mt-auto pt-1.5">
                      <NewContentButton slug={slug} pillars={pillars} goals={goals} defaultDate={day} compact dayLabel={dayLabel(day)} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {unscheduled.length ? (
            <section aria-labelledby="unscheduled-title" className="mt-8">
              <h3 id="unscheduled-title" className="text-small font-medium text-ink">
                Sin fecha
              </h3>
              <p className="mt-0.5 text-caption text-ink-2">Piezas en preparación que todavía no tienen día. Abrí una para ponerle fecha.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {unscheduled.map((item) => (
                  <li key={item.id}>
                    <Link href={`/w/${slug}/contenido/${item.id}`} className="flex max-w-[18rem] items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-small shadow-raised transition-transform duration-[var(--dur-fast)] hover:-translate-y-px">
                      <FormatIcon format={item.format} className="size-4 shrink-0 text-ink-2" />
                      <span className="truncate text-ink">{item.title}</span>
                      <span className="shrink-0 text-ink-2">
                        <StatusDot status={item.status} label={false} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <MonthGrid slug={slug} state={state} weeks={weeks} byDay={byDay} today={today} />
      )}
    </>
  );
}

function WeekSummary({ items, filtered }: { items: CalendarItem[]; filtered: boolean }) {
  if (!items.length) return <p className="text-caption text-ink-2">{filtered ? "Ninguna pieza coincide con los filtros." : "Todavía no hay piezas esta semana."}</p>;
  const approved = items.filter((i) => i.status === "APPROVED" || i.status === "SCHEDULED").length;
  const pending = items.filter((i) => i.status === "PENDING_APPROVAL").length;
  const published = items.filter((i) => i.status === "PUBLISHED").length;
  const parts = [`${items.length} ${items.length === 1 ? "pieza" : "piezas"}`];
  if (pending) parts.push(`${pending} para aprobar`);
  if (approved) parts.push(`${approved} ${approved === 1 ? "aprobada" : "aprobadas"}`);
  if (published) parts.push(`${published} ${published === 1 ? "publicada" : "publicadas"}`);
  return <p className="tabular text-caption text-ink-2">{parts.join(" · ")}</p>;
}

function PieceCard({ slug, item }: { slug: string; item: CalendarItem }) {
  return (
    <Link
      href={`/w/${slug}/contenido/${item.id}`}
      className={`group flex flex-col gap-1 rounded-[10px] bg-surface p-2.5 shadow-raised transition-[transform,box-shadow] duration-[var(--dur-fast)] hover:-translate-y-px hover:shadow-floating ${item.status === "ARCHIVED" ? "opacity-60" : ""}`}
    >
      <span className="flex items-center justify-between gap-2 text-caption text-ink-2">
        <span className="tabular">{item.time}</span>
        <span className="inline-flex items-center gap-1" title={FORMAT_LABELS[item.format]}>
          <FormatIcon format={item.format} className="size-3.5" />
          <span className="sr-only">{FORMAT_LABELS[item.format]}</span>
        </span>
      </span>
      <span className="line-clamp-3 text-small font-medium leading-snug text-ink">{item.title}</span>
      <span className="min-w-0 text-caption text-ink-2">
        <StatusDot status={item.status} short />
      </span>
    </Link>
  );
}

function MonthGrid({ slug, state, weeks, byDay, today }: { slug: string; state: CalendarState; weeks: string[]; byDay: Map<string, CalendarItem[]>; today: string }) {
  const month = state.date.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-raised">
      <div aria-hidden className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="px-2 py-2 text-caption text-ink-2 sm:px-3">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {weeks.flatMap((week) =>
          Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((day) => {
            const items = byDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== month;
            const isToday = day === today;
            const weekHref = calendarHref(slug, state, { view: "semana", date: day });
            return (
              <li key={day} className={`min-h-[5.5rem] min-w-0 border-b border-r border-line p-1 last:border-r-0 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${outside ? "bg-pearl/40" : ""}`}>
                <Link
                  href={weekHref}
                  aria-label={`${dayLabel(day)}${items.length ? `, ${items.length} ${items.length === 1 ? "pieza" : "piezas"}` : ""}. Ver la semana`}
                  className={`tabular inline-grid size-6 place-items-center rounded-full text-caption font-medium transition-colors ${isToday ? "bg-accent text-white" : outside ? "text-ink-3 hover:bg-pearl" : "text-ink hover:bg-pearl"}`}
                >
                  {dayNumber(day)}
                </Link>
                {items.length ? (
                  <span aria-hidden className="mt-1 flex flex-wrap gap-1 px-1 sm:hidden">
                    {items.map((item) => (
                      <StatusDot key={item.id} status={item.status} label={false} />
                    ))}
                  </span>
                ) : null}
                {items.length ? (
                  <ul className="mt-1 hidden flex-col gap-0.5 sm:flex">
                    {items.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <Link href={`/w/${slug}/contenido/${item.id}`} className="flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-caption text-ink hover:bg-pearl">
                          <StatusDot status={item.status} label={false} />
                          <span className="tabular hidden shrink-0 text-ink-2 xl:inline">{item.time}</span>
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </li>
                    ))}
                    {items.length > 3 ? (
                      <li>
                        <Link href={weekHref} className="px-1 text-caption text-ink-2 hover:text-ink">
                          {items.length - 3} más
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            );
          }),
        )}
      </ol>
    </div>
  );
}
