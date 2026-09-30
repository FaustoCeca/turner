import { BLOCK_MINUTES, type WeekSchedule } from "./schedule";
import { addDays, diffDays, weekdayOf, zonedToUtc } from "./time";

/** Intervalo ocupado en milisegundos epoch, `end` exclusivo. */
export type BusyInterval = { start: number; end: number };

export type DayStatus = "available" | "full" | "closed";

export type DayAvailability = {
  date: string;
  weekday: number;
  status: DayStatus;
  /** Minutos desde la medianoche local en que puede comenzar un turno. */
  slots: number[];
};

export type DayInput = {
  date: string;
  timeZone: string;
  schedule: WeekSchedule;
  /** Días de la semana en que el profesional ofrece el servicio (0 = lunes). */
  serviceWeekdays: number[];
  blockingMinutes: number;
  /** Minutos de cada hora habilitados para comenzar (ej. [0, 15, 30, 45]). */
  slotMinutes: number[];
  busy: BusyInterval[];
  /** Instante mínimo de comienzo (ahora + anticipación mínima), en ms. */
  earliestStart: number;
};

function overlaps(start: number, end: number, busy: BusyInterval[]): boolean {
  for (const b of busy) if (start < b.end && b.start < end) return true;
  return false;
}

export function computeDay(input: DayInput): DayAvailability {
  const weekday = weekdayOf(input.date);
  const day = input.schedule[weekday];
  const base = { date: input.date, weekday };

  if (!day?.enabled || day.ranges.length === 0 || !input.serviceWeekdays.includes(weekday)) {
    return { ...base, status: "closed", slots: [] };
  }

  const allowed = new Set(input.slotMinutes);
  const blockMs = input.blockingMinutes * 60_000;
  const slots: number[] = [];

  for (const range of day.ranges) {
    const first = Math.ceil(range.start / BLOCK_MINUTES) * BLOCK_MINUTES;
    for (let t = first; t + input.blockingMinutes <= range.end; t += BLOCK_MINUTES) {
      if (!allowed.has(t % 60)) continue;
      const start = zonedToUtc(input.date, t, input.timeZone).getTime();
      if (start < input.earliestStart) continue;
      if (overlaps(start, start + blockMs, input.busy)) continue;
      slots.push(t);
    }
  }

  return { ...base, status: slots.length ? "available" : "full", slots };
}

export type RangeInput = Omit<DayInput, "date" | "earliestStart"> & {
  now: Date;
  today: string;
  minAnticipationMinutes: number;
  maxDaysInFuture: number;
};

/** Disponibilidad desde hoy hasta hoy + maxDaysInFuture (inclusive). */
export function computeRange(input: RangeInput): DayAvailability[] {
  const earliestStart = input.now.getTime() + input.minAnticipationMinutes * 60_000;
  const days: DayAvailability[] = [];
  for (let i = 0; i <= input.maxDaysInFuture; i++) {
    days.push(computeDay({ ...input, date: addDays(input.today, i), earliestStart }));
  }
  return days;
}

/** ¿La fecha está dentro de la ventana de reserva del negocio? */
export function isWithinWindow(date: string, today: string, maxDaysInFuture: number): boolean {
  const d = diffDays(date, today);
  return d >= 0 && d <= maxDaysInFuture;
}
