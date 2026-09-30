import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

/** Fecha local "YYYY-MM-DD" + minutos desde medianoche → instante UTC. */
export function zonedToUtc(date: string, minutes: number, timeZone: string): Date {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${date}T${hh}:${mm}:00`, timeZone);
}

/** Instante → fecha local "YYYY-MM-DD" y minutos desde la medianoche local. */
export function utcToZoned(instant: Date, timeZone: string): { date: string; minutes: number } {
  const date = formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
  const [h, m] = formatInTimeZone(instant, timeZone, "HH:mm").split(":").map(Number);
  return { date, minutes: h * 60 + m };
}

export function todayIn(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

function parseDate(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

export function isValidDateStr(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = parseDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parseDate(a);
  const [by, bm, bd] = parseDate(b);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayOf(date: string): number {
  const [y, m, d] = parseDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function formatInTz(instant: Date, timeZone: string, pattern: string): string {
  return formatInTimeZone(instant, timeZone, pattern, { locale: es });
}

/** "jueves 1 de octubre, 10:00 hs" */
export function formatLongDateTime(instant: Date, timeZone: string): string {
  return `${formatInTz(instant, timeZone, "EEEE d 'de' MMMM")}, ${formatInTz(instant, timeZone, "H:mm")} hs`;
}
