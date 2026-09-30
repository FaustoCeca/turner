import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments, bookings, branches, businesses, professionals, services } from "@/db/schema";
import { applyPaymentUpdate } from "./bookings";
import { fetchPayment, findPaymentByReference, getSellerToken } from "./mercadopago";

/** Reserva del usuario con sus turnos. null si no existe o no le pertenece. */
export async function getUserBooking(bookingId: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select({ appointment: appointments, branch: branches, professional: professionals, notes: services.notes })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(eq(appointments.bookingId, bookingId))
    .orderBy(asc(appointments.startsAt));
  return { ...row, items };
}

/**
 * Al volver del checkout, consultamos el pago directamente a Mercado Pago
 * (nunca confiamos en los parámetros de la URL) por si el webhook todavía no llegó.
 */
export async function syncMercadoPagoPayment(bookingId: string, paymentIdFromUrl?: string | null): Promise<void> {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.id, bookingId));
  if (!row || row.booking.paymentProvider !== "mercadopago") return;
  if (row.booking.status === "confirmed" || row.booking.status === "cancelled") return;

  const token = await getSellerToken(db, row.business);
  if (!token) return;
  try {
    const payment =
      paymentIdFromUrl && /^\d+$/.test(paymentIdFromUrl)
        ? await fetchPayment(token, paymentIdFromUrl)
        : await findPaymentByReference(token, bookingId);
    if (!payment || payment.externalReference !== bookingId) return;
    await applyPaymentUpdate(bookingId, {
      provider: "mercadopago",
      id: payment.id,
      status: payment.status,
      statusDetail: payment.statusDetail,
      amount: payment.amount,
      refunded: payment.refunded,
      expiresAt: payment.expiresAt,
      raw: payment.raw,
    });
  } catch (err) {
    console.error("[mp] no se pudo sincronizar el pago", bookingId, err);
  }
}
