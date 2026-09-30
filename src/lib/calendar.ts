/** Utilidades para "Agregar al calendario": el calendario del cliente hace de recordatorio. */

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description?: string;
  url?: string;
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}

/** Archivo iCalendar (iPhone, Outlook, Google) con alarmas 1 día y 2 horas antes. */
export function buildIcs(events: CalendarEvent[], appName: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${appName}//Turnos//ES`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      `LOCATION:${escapeText(e.location)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`Mañana: ${e.title}`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`En 2 horas: ${e.title}`)}`,
      "TRIGGER:-PT2H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: Omit<CalendarEvent, "uid">): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    location: e.location,
    ...(e.description ? { details: e.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
