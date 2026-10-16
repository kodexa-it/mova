// Fechas del calendario. Las piezas guardan un instante en UTC; el calendario
// trabaja con días ("YYYY-MM-DD") y horas ("HH:MM") en la zona horaria del
// público de la marca (Brand.audienceTimezone). Sin dependencias: Intl alcanza
// y maneja los cambios de horario.

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOfUtc = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const utcOfYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};

export function addDays(ymd: string, days: number): string {
  const date = utcOfYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return ymdOfUtc(date);
}

export function addMonths(ymd: string, months: number): string {
  const date = utcOfYmd(ymd);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return ymdOfUtc(date);
}

// 1 = lunes … 7 = domingo.
export function weekdayOf(ymd: string): number {
  return ((utcOfYmd(ymd).getUTCDay() + 6) % 7) + 1;
}

// Las semanas empiezan el lunes.
export function weekStartOf(ymd: string): string {
  return addDays(ymd, 1 - weekdayOf(ymd));
}

export function monthStartOf(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

// Semanas (lunes) que cubren el mes completo, para la vista mensual.
export function monthWeeks(ymd: string): string[] {
  const first = monthStartOf(ymd);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[] = [];
  for (let w = weekStartOf(first); w <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second) };
}

// Diferencia entre la hora de la zona y UTC en ese instante.
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// Día y hora locales → instante UTC. Si la hora no existe (salto de horario),
// se corre hacia adelante, como hacen los calendarios.
export function zonedToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hm.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - offsetMs(new Date(wall), timeZone);
  const second = wall - offsetMs(new Date(guess), timeZone);
  if (second !== guess) guess = Math.max(guess, second);
  return new Date(guess);
}

export function zonedYmd(date: Date, timeZone: string): string {
  const p = parts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function zonedHm(date: Date, timeZone: string): string {
  const p = parts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayIn(timeZone: string, now = new Date()): string {
  return zonedYmd(now, timeZone);
}

// Rango [desde, hasta) en UTC para los días locales [from, toExclusive).
export function zonedRange(from: string, toExclusive: string, timeZone: string) {
  return { gte: zonedToUtc(from, "00:00", timeZone), lt: zonedToUtc(toExclusive, "00:00", timeZone) };
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function monthLabel(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number) as [number, number];
  const name = MONTHS[m - 1]!;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

// "13 al 19 de octubre", "27 de octubre al 2 de noviembre", con año si cruza.
export function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const [y1, m1, d1] = weekStart.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  if (y1 !== y2) return `${d1} de ${MONTHS[m1 - 1]} de ${y1} al ${d2} de ${MONTHS[m2 - 1]} de ${y2}`;
  if (m1 !== m2) return `${d1} de ${MONTHS[m1 - 1]} al ${d2} de ${MONTHS[m2 - 1]}`;
  return `${d1} al ${d2} de ${MONTHS[m1 - 1]}`;
}

export function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS[weekdayOf(ymd) - 1]} ${d} de ${MONTHS[m - 1]}`;
}

export function dayNumber(ymd: string): number {
  return Number(ymd.slice(8, 10));
}
