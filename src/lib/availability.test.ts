import { describe, expect, it } from "vitest";
import { computeDay, computeRange } from "./availability";
import { defaultSchedule, formatSlot, type WeekSchedule } from "./schedule";
import { zonedToUtc } from "./time";

const TZ = "America/Argentina/Buenos_Aires";
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ).getTime();
};

// Martes a viernes 9:30–19:00, lunes 15:30–19:00 (horario real relevado en el sitio de referencia).
const schedule: WeekSchedule = [
  { enabled: true, ranges: [{ start: 15 * 60 + 30, end: 19 * 60 }] },
  ...[1, 2, 3, 4].map(() => ({ enabled: true, ranges: [{ start: 9 * 60 + 30, end: 19 * 60 }] })),
  { enabled: false, ranges: [{ start: 9 * 60 + 30, end: 12 * 60 + 45 }] },
  { enabled: false, ranges: [] },
];

describe("computeDay", () => {
  it("reproduce los horarios del jueves con dos turnos tomados", () => {
    const day = computeDay({
      date: "2026-10-01",
      timeZone: TZ,
      schedule,
      serviceWeekdays: [0, 1, 2, 3, 4],
      blockingMinutes: 30,
      slotMinutes: [0, 15, 30, 45],
      busy: [
        { start: at("2026-10-01", "11:15"), end: at("2026-10-01", "11:45") },
        { start: at("2026-10-01", "18:00"), end: at("2026-10-01", "18:30") },
      ],
      earliestStart: at("2026-09-30", "11:00"),
    });

    const expected = [
      "9:30", "9:45", "10:00", "10:15", "10:30", "10:45", "11:45",
      ...Array.from({ length: 20 }, (_, i) => formatSlot(12 * 60 + i * 15)), // 12:00 … 16:45
      "17:00", "17:15", "17:30", "18:30",
    ];
    expect(day.status).toBe("available");
    expect(day.slots.map(formatSlot)).toEqual(expected);
  });

  it("marca cerrado los días que no atiende o en que no ofrece el servicio", () => {
    const base = {
      timeZone: TZ,
      schedule,
      blockingMinutes: 30,
      slotMinutes: [0, 15, 30, 45],
      busy: [],
      earliestStart: 0,
    };
    expect(computeDay({ ...base, date: "2026-10-03", serviceWeekdays: [0, 1, 2, 3, 4, 5, 6] }).status).toBe("closed"); // sábado deshabilitado
    expect(computeDay({ ...base, date: "2026-10-02", serviceWeekdays: [0, 1, 2, 3] }).status).toBe("closed"); // viernes sin servicio
  });

  it("marca lleno el día de hoy cuando ya pasaron todos los horarios", () => {
    const day = computeDay({
      date: "2026-09-30",
      timeZone: TZ,
      schedule,
      serviceWeekdays: [0, 1, 2, 3, 4],
      blockingMinutes: 30,
      slotMinutes: [0, 15, 30, 45],
      busy: [],
      earliestStart: at("2026-09-30", "18:40"),
    });
    expect(day.status).toBe("full");
  });

  it("respeta los minutos habilitados y los turnos partidos", () => {
    const split = defaultSchedule();
    split[0] = { enabled: true, ranges: [{ start: 9 * 60, end: 10 * 60 }, { start: 14 * 60, end: 15 * 60 }] };
    const day = computeDay({
      date: "2026-10-05", // lunes
      timeZone: TZ,
      schedule: split,
      serviceWeekdays: [0],
      blockingMinutes: 30,
      slotMinutes: [0, 30],
      busy: [],
      earliestStart: 0,
    });
    expect(day.slots.map(formatSlot)).toEqual(["9:00", "9:30", "14:00", "14:30"]);
  });
});

describe("computeRange", () => {
  it("devuelve hoy + maxDaysInFuture días", () => {
    const days = computeRange({
      timeZone: TZ,
      schedule,
      serviceWeekdays: [0, 1, 2, 3, 4],
      blockingMinutes: 30,
      slotMinutes: [0, 15, 30, 45],
      busy: [],
      now: new Date(at("2026-09-30", "11:00")),
      today: "2026-09-30",
      minAnticipationMinutes: 120,
      maxDaysInFuture: 25,
    });
    expect(days).toHaveLength(26);
    expect(days[0].date).toBe("2026-09-30");
    expect(days.at(-1)?.date).toBe("2026-10-25");
    // Con 2 h de anticipación, el primer horario de hoy es 13:00.
    expect(formatSlot(days[0].slots[0])).toBe("13:00");
  });
});
