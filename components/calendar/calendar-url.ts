// Estado del calendario en la URL: se puede compartir, recargar y volver atrás.
export interface CalendarState {
  view: "semana" | "mes";
  date: string;
  format?: string;
  status?: string;
  pillar?: string;
}

export function calendarHref(slug: string, state: CalendarState, patch: Partial<CalendarState> = {}): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  params.set("vista", next.view);
  params.set("fecha", next.date);
  if (next.format) params.set("formato", next.format);
  if (next.status) params.set("estado", next.status);
  if (next.pillar) params.set("pilar", next.pillar);
  return `/w/${slug}/calendario?${params.toString()}`;
}
