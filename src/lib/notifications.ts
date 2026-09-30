import "server-only";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments, bookings, businesses, clients, notifications, professionals } from "@/db/schema";
import { formatMoney } from "./pricing";
import { formatInTz, utcToZoned } from "./time";

type Kind = (typeof notifications.$inferInsert)["kind"];

async function loadRows(where: { bookingId?: string; appointmentId?: string }) {
  const db = await getDb();
  return db
    .select({ a: appointments, business: businesses, client: clients, pro: professionals, booking: bookings })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(where.bookingId ? eq(appointments.bookingId, where.bookingId) : eq(appointments.id, where.appointmentId!))
    .orderBy(asc(appointments.startsAt));
}

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function describe(r: Row): string {
  return `${r.a.serviceName} · ${formatInTz(r.a.startsAt, r.business.timezone, "EEE d/MM HH:mm")} hs · ${r.pro.firstName}`;
}

function agendaHref(r: Row): string {
  return `/panel?fecha=${utcToZoned(r.a.startsAt, r.business.timezone).date}&sucursal=${r.a.branchId}`;
}

async function insert(values: typeof notifications.$inferInsert) {
  const db = await getDb();
  await db.insert(notifications).values(values);
}

/** Aviso al negocio sobre una reserva completa (nueva, o seña devuelta por pago tardío). */
export async function notifyBookingEvent(bookingId: string, kind: Extract<Kind, "booking" | "refund">): Promise<void> {
  try {
    const rows = await loadRows({ bookingId });
    if (!rows.length) return;
    const { business, client, booking } = rows[0];
    const name = `${client.firstName} ${client.lastName}`.trim();
    const lines = rows.map(describe);
    if (kind === "booking" && booking && booking.paidAmount > 0) {
      lines.push(`Seña cobrada: ${formatMoney(booking.paidAmount, business.currency)}`);
    }
    await insert({
      businessId: business.id,
      kind,
      title: kind === "booking" ? `Nuevo turno de ${name}` : `Se devolvió la seña de ${name} (pago fuera de término)`,
      body: lines.join("\n"),
      href: agendaHref(rows[0]),
    });
  } catch (err) {
    console.error("[notificaciones]", err);
  }
}

/** Aviso al negocio sobre cambios que hizo el cliente en un turno. */
export async function notifyAppointmentEvent(
  appointmentId: string,
  kind: Extract<Kind, "cancellation" | "reschedule">,
  detail?: string,
): Promise<void> {
  try {
    const [r] = await loadRows({ appointmentId });
    if (!r) return;
    const name = `${r.client.firstName} ${r.client.lastName}`.trim();
    await insert({
      businessId: r.business.id,
      kind,
      title: kind === "cancellation" ? `${name} canceló su turno` : `${name} reprogramó su turno`,
      body: [describe(r), detail].filter(Boolean).join("\n"),
      href: agendaHref(r),
    });
  } catch (err) {
    console.error("[notificaciones]", err);
  }
}

export async function unreadCount(businessId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function latestNotifications(businessId: string, limit = 50) {
  const db = await getDb();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.businessId, businessId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
