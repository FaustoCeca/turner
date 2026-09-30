/** Rango horario en minutos desde la medianoche local. `end` es exclusivo. */
export type TimeRange = { start: number; end: number };
export type DaySchedule = { enabled: boolean; ranges: TimeRange[] };
/** 7 posiciones, 0 = lunes … 6 = domingo. */
export type WeekSchedule = DaySchedule[];

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export const BLOCK_MINUTES = 15;

export function defaultSchedule(): WeekSchedule {
  return ALL_WEEKDAYS.map((d) => ({
    enabled: d < 5,
    ranges: [{ start: 9 * 60, end: 18 * 60 }],
  }));
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "9:30" → 570. Devuelve null si el formato es inválido. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

/** "9:30" para mostrar al cliente (sin cero a la izquierda, como en la reserva). */
export function formatSlot(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Ordena y une rangos superpuestos, descarta los vacíos y los alinea a bloques de 15 minutos.
 * Lanza error si un rango es inválido.
 */
export function normalizeRanges(ranges: TimeRange[]): TimeRange[] {
  const clean = ranges
    .map((r) => ({ start: Math.round(r.start), end: Math.round(r.end) }))
    .filter((r) => r.end > r.start);
  for (const r of clean) {
    if (r.start < 0 || r.end > 24 * 60) throw new Error("Horario fuera del día");
    if (r.start % BLOCK_MINUTES || r.end % BLOCK_MINUTES)
      throw new Error("Los horarios deben ser múltiplos de 15 minutos");
  }
  clean.sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const r of clean) {
    const last = merged.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

export function normalizeSchedule(schedule: WeekSchedule): WeekSchedule {
  if (schedule.length !== 7) throw new Error("El horario debe tener 7 días");
  return schedule.map((day) => ({
    enabled: Boolean(day.enabled),
    ranges: normalizeRanges(day.ranges ?? []),
  }));
}

export function describeDay(day: DaySchedule): string {
  if (!day.enabled || day.ranges.length === 0) return "No atiende";
  return day.ranges.map((r) => `${minutesToHHMM(r.start)} a ${minutesToHHMM(r.end)}`).join(" y ");
}
