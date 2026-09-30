import "server-only";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, type DbOrTx, type Tx } from "@/db";
import {
  appointments,
  bookings,
  businesses,
  clients,
  coupons,
  payments,
  professionals,
  type Business,
  type Coupon,
} from "@/db/schema";
import type { SessionUser } from "./auth";
import type { BusyInterval } from "./availability";
import {
  createDepositPreference,
  getSellerToken,
  paymentModeFor,
  refundPayment,
  type PaymentMode,
} from "./mercadopago";
import { priceBooking } from "./pricing";
import { notifyAppointmentEvent, notifyBookingEvent } from "./notifications";
import { getSlotContext, isSlotBookable, loadBusy, type SlotContext } from "./slots";
import { formatLongDateTime, isValidDateStr, zonedToUtc } from "./time";

/** Error con mensaje apto para mostrar al usuario. */
export class BookingError extends Error {}

export type CartItemInput = {
  serviceId: string;
  professionalId: string;
  branchId: string;
  date: string;
  minutes: number;
};

const MAX_ITEMS = 10;

/**
 * Libera las reservas temporales vencidas (pendientes de pago) y los usos de cupón que tenían reservados.
 * Corre en su propia transacción: la disponibilidad no depende de esto (los holds vencidos ya no ocupan agenda).
 */
export async function expireHolds(businessId?: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const expired = await tx
      .update(bookings)
      .set({ status: "expired" })
      .where(
        and(
          eq(bookings.status, "pending_payment"),
          lt(bookings.holdExpiresAt, new Date()),
          businessId ? eq(bookings.businessId, businessId) : undefined,
        ),
      )
      .returning({ id: bookings.id, couponId: bookings.couponId });
    if (!expired.length) return;
    await tx
      .update(appointments)
      .set({ status: "expired" })
      .where(
        and(
          inArray(
            appointments.bookingId,
            expired.map((b) => b.id),
          ),
          eq(appointments.status, "pending_payment"),
        ),
      );
    for (const b of expired) if (b.couponId) await releaseCouponUse(tx, b.couponId);
  });
}

async function releaseCouponUse(tx: Tx, couponId: string): Promise<void> {
  await tx
    .update(coupons)
    .set({ usesCount: sql`greatest(${coupons.usesCount} - 1, 0)` })
    .where(eq(coupons.id, couponId));
}

/** Reserva un uso del cupón de forma atómica respetando el máximo de usos. */
async function reserveCouponUse(tx: Tx, couponId: string, enforceLimit = true): Promise<void> {
  const [row] = await tx
    .update(coupons)
    .set({ usesCount: sql`${coupons.usesCount} + 1` })
    .where(
      and(
        eq(coupons.id, couponId),
        enforceLimit ? or(isNull(coupons.maxUses), lt(coupons.usesCount, coupons.maxUses)) : undefined,
      ),
    )
    .returning({ id: coupons.id });
  if (!row) throw new BookingError("El código de descuento ya no tiene usos disponibles");
}

/** Bloquea a los profesionales en orden para serializar reservas concurrentes sobre su agenda. */
export async function lockProfessionals(tx: Tx, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return;
  await tx
    .select({ id: professionals.id })
    .from(professionals)
    .where(inArray(professionals.id, unique))
    .orderBy(asc(professionals.id))
    .for("update");
}

export async function findValidCoupon(
  db: DbOrTx,
  businessId: string,
  code: string,
  now = new Date(),
): Promise<Coupon> {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.businessId, businessId), eq(coupons.code, code.trim().toUpperCase())))
    .limit(1);
  if (!coupon || !coupon.isActive) throw new BookingError("El código de descuento no es válido");
  if (coupon.validFrom && coupon.validFrom > now) throw new BookingError("El código todavía no está vigente");
  if (coupon.validUntil && coupon.validUntil < now) throw new BookingError("El código de descuento venció");
  if (coupon.maxUses != null && coupon.usesCount >= coupon.maxUses)
    throw new BookingError("El código de descuento ya no tiene usos disponibles");
  return coupon;
}

async function upsertClientForUser(tx: DbOrTx, businessId: string, user: SessionUser) {
  const [existing] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, businessId), eq(clients.userId, user.id)))
    .limit(1);
  if (existing) return existing;
  // Dos primeras reservas simultáneas del mismo usuario: la segunda no falla por el índice único.
  await tx
    .insert(clients)
    .values({
      businessId,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
    })
    .onConflictDoNothing();
  const [client] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, businessId), eq(clients.userId, user.id)))
    .limit(1);
  return client;
}

export async function getBusinessBySlug(db: DbOrTx, slug: string): Promise<Business | null> {
  const [b] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return b ?? null;
}

/* ───────────────────────────── Crear reserva ───────────────────────────── */

export async function createOnlineBooking(params: {
  slug: string;
  user: SessionUser;
  items: CartItemInput[];
  couponCode?: string | null;
  notes?: string | null;
}): Promise<{ bookingId: string; redirectUrl: string }> {
  const db = await getDb();
  const business = await getBusinessBySlug(db, params.slug);
  if (!business || !business.isOnline) throw new BookingError("El negocio no está tomando reservas online");
  if (!params.items.length) throw new BookingError("Agregá al menos un servicio");
  if (params.items.length > MAX_ITEMS) throw new BookingError("Demasiados servicios en una misma reserva");
  for (const item of params.items) {
    if (!isValidDateStr(item.date) || !Number.isInteger(item.minutes)) throw new BookingError("Horario inválido");
  }

  const now = new Date();
  await expireHolds(business.id);
  const result = await db.transaction(async (tx) => {
    await lockProfessionals(
      tx,
      params.items.map((i) => i.professionalId),
    );

    // Validación de cada turno contra la agenda real (incluye los otros turnos del carrito).
    const cartBusy = new Map<string, BusyInterval[]>();
    const resolved: { item: CartItemInput; ctx: SlotContext; startsAt: Date }[] = [];
    for (const item of params.items) {
      const ctx = await getSlotContext(tx, business.id, item, { onlineOnly: true });
      if (!ctx) throw new BookingError("Uno de los servicios elegidos ya no está disponible");
      const extraBusy = cartBusy.get(item.professionalId) ?? [];
      const ok = await isSlotBookable(tx, business, ctx, item.date, item.minutes, { now, extraBusy });
      if (!ok) {
        throw new BookingError(
          "Uno de los horarios elegidos ya no está disponible. Volvé a elegir fecha y hora.",
        );
      }
      const startsAt = zonedToUtc(item.date, item.minutes, business.timezone);
      extraBusy.push({
        start: startsAt.getTime(),
        end: startsAt.getTime() + ctx.service.blockingMinutes * 60_000,
      });
      cartBusy.set(item.professionalId, extraBusy);
      resolved.push({ item, ctx, startsAt });
    }

    const client = await upsertClientForUser(tx, business.id, params.user);
    if (client.isBlocked) throw new BookingError("No podés reservar turnos en este negocio. Contactalo directamente.");

    const coupon = params.couponCode ? await findValidCoupon(tx, business.id, params.couponCode, now) : null;
    const pricing = priceBooking(
      resolved.map(({ ctx }) => ({
        price: ctx.service.price,
        priceTBD: ctx.service.priceTBD,
        depositApplies: business.requireDeposit && ctx.service.depositEnabled && !client.depositExempt,
        depositPercent: ctx.service.depositPercent ?? business.depositPercent,
      })),
      coupon,
      business.depositMinAmount,
    );

    let mode: PaymentMode | null = null;
    if (pricing.deposit > 0) {
      mode = paymentModeFor(business);
      if (!mode) throw new BookingError("El negocio todavía no configuró el cobro de señas. Probá más tarde.");
    }
    const needsPayment = pricing.deposit > 0;
    if (coupon) await reserveCouponUse(tx, coupon.id);
    const holdExpiresAt = needsPayment ? new Date(now.getTime() + business.holdMinutes * 60_000) : null;

    const [booking] = await tx
      .insert(bookings)
      .values({
        businessId: business.id,
        clientId: client.id,
        userId: params.user.id,
        status: needsPayment ? "pending_payment" : "confirmed",
        source: "online",
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        total: pricing.total,
        depositAmount: pricing.deposit,
        couponId: coupon?.id,
        paymentStatus: needsPayment ? "pending" : "none",
        paymentProvider: mode,
        holdExpiresAt,
      })
      .returning();

    await tx.insert(appointments).values(
      resolved.map(({ ctx, startsAt }, idx) => ({
        bookingId: booking.id,
        businessId: business.id,
        branchId: ctx.branchId,
        professionalId: ctx.professionalId,
        serviceId: ctx.service.id,
        clientId: client.id,
        serviceName: ctx.service.name,
        startsAt,
        endsAt: new Date(startsAt.getTime() + ctx.service.durationMinutes * 60_000),
        blockEndsAt: new Date(startsAt.getTime() + ctx.service.blockingMinutes * 60_000),
        price: pricing.items[idx].price,
        discount: pricing.items[idx].discount,
        depositAmount: pricing.items[idx].deposit,
        status: needsPayment ? ("pending_payment" as const) : ("confirmed" as const),
        notes: params.notes?.slice(0, 500) || null,
      })),
    );

    return { booking, mode, holdExpiresAt, pricing, firstService: resolved[0].ctx.service.name };
  });

  const { booking, mode } = result;
  const bookingUrl = `/${business.slug}/reserva/${booking.id}`;

  if (!mode) {
    void notifyBookingEvent(booking.id, "booking");
    return { bookingId: booking.id, redirectUrl: bookingUrl };
  }

  if (mode === "mock") {
    const checkoutUrl = `/pago-simulado/${booking.id}`;
    await db.update(bookings).set({ checkoutUrl }).where(eq(bookings.id, booking.id));
    return { bookingId: booking.id, redirectUrl: checkoutUrl };
  }

  try {
    const token = await getSellerToken(db, business);
    if (!token) throw new Error("sin token");
    const count = params.items.length;
    const pref = await createDepositPreference(token, {
      bookingId: booking.id,
      businessId: business.id,
      businessName: business.name,
      slug: business.slug,
      title: `Seña ${business.name} - ${count > 1 ? `${count} servicios` : result.firstService}`,
      amount: booking.depositAmount,
      currency: business.currency,
      payer: { email: params.user.email, firstName: params.user.firstName, lastName: params.user.lastName },
      expiresAt: result.holdExpiresAt!,
    });
    await db
      .update(bookings)
      .set({ mpPreferenceId: pref.id, checkoutUrl: pref.checkoutUrl })
      .where(eq(bookings.id, booking.id));
    return { bookingId: booking.id, redirectUrl: pref.checkoutUrl };
  } catch (err) {
    console.error("[booking] no se pudo crear la preferencia de pago", err);
    await db.update(bookings).set({ status: "expired" }).where(eq(bookings.id, booking.id));
    await db.update(appointments).set({ status: "expired" }).where(eq(appointments.bookingId, booking.id));
    throw new BookingError("No pudimos iniciar el pago con Mercado Pago. Intentá nuevamente.");
  }
}

/* ───────────────────────────── Pagos ───────────────────────────── */

export type PaymentUpdate = {
  provider: "mercadopago" | "mock";
  id: string;
  status: string;
  statusDetail?: string | null;
  amount: number;
  refunded?: number;
  expiresAt?: Date | null;
  raw?: unknown;
};

const APPROVED = new Set(["approved"]);
const PENDING = new Set(["pending", "in_process", "authorized", "in_mediation"]);
const FAILED = new Set(["rejected", "cancelled"]);

/**
 * Aplica el estado de un pago (webhook, retorno del checkout o pago simulado).
 * Idempotente: puede llamarse varias veces con el mismo pago.
 */
export async function applyPaymentUpdate(bookingId: string, payment: PaymentUpdate): Promise<void> {
  const db = await getDb();
  const now = new Date();

  await db
    .insert(payments)
    .values({
      bookingId,
      provider: payment.provider,
      externalId: payment.id,
      status: payment.status,
      statusDetail: payment.statusDetail ?? null,
      amount: payment.amount,
      raw: payment.raw ?? null,
    })
    .onConflictDoUpdate({
      target: [payments.provider, payments.externalId],
      set: { status: payment.status, statusDetail: payment.statusDetail ?? null, raw: payment.raw ?? null },
    });

  const outcome = await db.transaction(async (tx): Promise<PaymentOutcome> => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!booking) return { action: "none" };

    if (APPROVED.has(payment.status)) {
      const alreadyPaid = booking.paidAmount > 0 || booking.paymentStatus === "approved" || booking.paymentStatus === "refunded";
      // Misma notificación repetida (reintentos de Mercado Pago, payment.updated, etc.): no hay nada que hacer.
      if (alreadyPaid && booking.paymentId === payment.id) return { action: "none" };
      // Otro pago aprobado para una reserva ya paga (p. ej. pagó con tarjeta y después el cupón de Rapipago).
      if (alreadyPaid) return { action: "refund_stray" };
      if (payment.amount < booking.depositAmount) {
        console.warn(`[payment] monto insuficiente para ${bookingId}: ${payment.amount}`);
        return { action: "none" };
      }

      await tx
        .update(bookings)
        .set({ paymentStatus: "approved", paymentId: payment.id, paidAmount: payment.amount })
        .where(eq(bookings.id, bookingId));

      if (booking.status === "confirmed") return { action: "none" };

      const appts = (await tx.select().from(appointments).where(eq(appointments.bookingId, bookingId))).filter(
        (a) => a.status !== "cancelled",
      );
      const holdValid =
        booking.status === "pending_payment" && (booking.holdExpiresAt?.getTime() ?? 0) > now.getTime();

      // Si la reserva temporal venció, sólo confirmamos si los turnos son futuros y siguen libres.
      let stillFree = holdValid && appts.length > 0;
      if (!holdValid && booking.status !== "cancelled" && appts.length > 0) {
        await lockProfessionals(
          tx,
          appts.map((a) => a.professionalId),
        );
        stillFree = true;
        for (const a of appts) {
          if (a.startsAt.getTime() <= now.getTime()) {
            stillFree = false;
            break;
          }
          const busy = await loadBusy(tx, {
            businessId: booking.businessId,
            professionalId: a.professionalId,
            branchId: a.branchId,
            from: a.startsAt,
            to: a.blockEndsAt,
            now,
            excludeAppointmentIds: appts.map((x) => x.id),
          });
          if (busy.some((b) => b.start < a.blockEndsAt.getTime() && a.startsAt.getTime() < b.end)) {
            stillFree = false;
            break;
          }
        }
      }

      if (!stillFree) {
        // La reserva se canceló o venció antes del pago y el horario ya no está: se devuelve todo.
        await tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, bookingId));
        await tx
          .update(appointments)
          .set({ status: "cancelled", cancelledAt: now, cancelledBy: "system", cancelReason: "Pago acreditado fuera de término" })
          .where(and(eq(appointments.bookingId, bookingId), inArray(appointments.status, ["pending_payment", "expired"])));
        if (booking.couponId && booking.status === "pending_payment") await releaseCouponUse(tx, booking.couponId);
        return { action: "refund", amount: payment.amount };
      }

      await tx.update(bookings).set({ status: "confirmed", holdExpiresAt: null }).where(eq(bookings.id, bookingId));
      await tx
        .update(appointments)
        .set({ status: "confirmed" })
        .where(and(eq(appointments.bookingId, bookingId), inArray(appointments.status, ["pending_payment", "expired"])));
      // Al vencer se había liberado el uso del cupón: se vuelve a contar (ya pagó, sin tope).
      if (booking.couponId && booking.status === "expired") await reserveCouponUse(tx, booking.couponId, false);
      // Si el cliente canceló parte del carrito antes de pagar, pagó de más: se devuelve la diferencia.
      const excess = payment.amount - booking.depositAmount;
      return { action: "confirmed", excess };
    }

    if (booking.status !== "pending_payment") return { action: "none" };

    if (PENDING.has(payment.status)) {
      // Pago en efectivo (Rapipago/Pago Fácil): mantenemos el turno hasta que venza el cupón de pago.
      const [first] = await tx
        .select({ startsAt: appointments.startsAt })
        .from(appointments)
        .where(eq(appointments.bookingId, bookingId))
        .orderBy(asc(appointments.startsAt))
        .limit(1);
      const limit = Math.min(
        payment.expiresAt?.getTime() ?? now.getTime() + 48 * 3_600_000,
        first?.startsAt.getTime() ?? Infinity,
      );
      const hold = Math.max(booking.holdExpiresAt?.getTime() ?? 0, limit);
      await tx
        .update(bookings)
        .set({ paymentStatus: "pending", paymentId: payment.id, holdExpiresAt: new Date(hold) })
        .where(eq(bookings.id, bookingId));
    } else if (FAILED.has(payment.status)) {
      await tx.update(bookings).set({ paymentStatus: "rejected" }).where(eq(bookings.id, bookingId));
    }
    return { action: "none" };
  });

  if (outcome.action === "confirmed") {
    void notifyBookingEvent(bookingId, "booking");
    if (outcome.excess > 0) await refundBooking(bookingId, outcome.excess);
  }
  if (outcome.action === "refund") {
    await refundBooking(bookingId, outcome.amount);
    void notifyBookingEvent(bookingId, "refund");
  }
  if (outcome.action === "refund_stray") await refundStrayPayment(bookingId, payment);
}

type PaymentOutcome =
  | { action: "none" }
  | { action: "confirmed"; excess: number }
  | { action: "refund"; amount: number }
  | { action: "refund_stray" };

/** Devuelve un pago que no corresponde a la reserva (pago duplicado). */
async function refundStrayPayment(bookingId: string, payment: PaymentUpdate): Promise<void> {
  const db = await getDb();
  try {
    if (payment.provider === "mercadopago") {
      const [row] = await db
        .select({ business: businesses })
        .from(bookings)
        .innerJoin(businesses, eq(businesses.id, bookings.businessId))
        .where(eq(bookings.id, bookingId));
      const token = row && (await getSellerToken(db, row.business));
      if (!token) throw new Error("sin token del negocio");
      await refundPayment(token, payment.id, undefined, `refund-stray-${payment.id}`);
    }
    await db
      .update(payments)
      .set({ status: "refunded", statusDetail: "pago duplicado devuelto" })
      .where(and(eq(payments.provider, payment.provider), eq(payments.externalId, payment.id)));
  } catch (err) {
    console.error("[payment] no se pudo devolver el pago duplicado", bookingId, payment.id, err);
  }
}

/**
 * Devuelve (total o parcialmente) la seña de una reserva. Reserva el monto en la base (con la fila
 * bloqueada) antes de llamar a Mercado Pago, así dos devoluciones simultáneas no superan lo cobrado.
 */
export async function refundBooking(bookingId: string, amount: number): Promise<boolean> {
  const db = await getDb();
  const reserved = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!booking?.paymentId || amount <= 0) return null;
    const value = Math.min(amount, booking.paidAmount - booking.refundedAmount);
    if (value <= 0) return null;
    const refunded = booking.refundedAmount + value;
    await tx
      .update(bookings)
      .set({ refundedAmount: refunded, paymentStatus: refunded >= booking.paidAmount ? "refunded" : booking.paymentStatus })
      .where(eq(bookings.id, bookingId));
    return { booking, paymentId: booking.paymentId, value, before: booking.refundedAmount };
  });
  if (!reserved) return false;
  if (reserved.booking.paymentProvider !== "mercadopago") return true;

  try {
    const [business] = await db.select().from(businesses).where(eq(businesses.id, reserved.booking.businessId));
    const token = business && (await getSellerToken(db, business));
    if (!token) throw new Error("sin token del negocio");
    const full = reserved.before === 0 && reserved.value === reserved.booking.paidAmount;
    await refundPayment(
      token,
      reserved.paymentId,
      full ? undefined : reserved.value,
      `refund-${reserved.paymentId}-${reserved.before}-${reserved.value}`,
    );
    return true;
  } catch (err) {
    console.error("[refund] falló la devolución en Mercado Pago", bookingId, err);
    await db
      .update(bookings)
      .set({ refundedAmount: sql`${bookings.refundedAmount} - ${reserved.value}`, paymentStatus: "approved" })
      .where(eq(bookings.id, bookingId));
    return false;
  }
}

/* ─────────────────────── Cancelar / reprogramar ─────────────────────── */

/**
 * Bloquea un turno respetando el orden global de locks (reserva → profesionales → turno)
 * para no chocar con la confirmación de pagos. `extraProfessionals` se suma a los bloqueados.
 */
export async function lockAppointment(
  tx: Tx,
  appointmentId: string,
  opts: { professionals?: boolean; extraProfessionals?: string[] } = {},
) {
  const [pre] = await tx
    .select({ bookingId: appointments.bookingId, professionalId: appointments.professionalId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!pre) return null;
  if (pre.bookingId) {
    await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, pre.bookingId)).for("update");
  }
  if (opts.professionals) await lockProfessionals(tx, [pre.professionalId, ...(opts.extraProfessionals ?? [])]);
  return loadAppointmentForUpdate(tx, appointmentId);
}

async function loadAppointmentForUpdate(tx: Tx, appointmentId: string) {
  const [row] = await tx
    .select({ appointment: appointments, business: businesses, client: clients, booking: bookings })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(eq(appointments.id, appointmentId))
    .for("update", { of: appointments });
  return row ?? null;
}

export function clientCanModify(
  appointment: { startsAt: Date; status: string },
  business: Pick<Business, "minAnticipationEditMinutes">,
  now = new Date(),
): boolean {
  if (!["confirmed", "pending_payment"].includes(appointment.status)) return false;
  return appointment.startsAt.getTime() - now.getTime() >= business.minAnticipationEditMinutes * 60_000;
}

export function refundApplies(
  appointment: { startsAt: Date },
  business: Pick<Business, "autoRefund" | "refundMinAnticipationMinutes">,
  now = new Date(),
): boolean {
  if (!business.autoRefund) return false;
  return appointment.startsAt.getTime() - now.getTime() >= business.refundMinAnticipationMinutes * 60_000;
}

export async function cancelAppointment(params: {
  appointmentId: string;
  by: "client" | "business";
  userId: string;
  businessId?: string;
  reason?: string | null;
  refund?: boolean;
}): Promise<{ refunded: number }> {
  const db = await getDb();
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const row = await lockAppointment(tx, params.appointmentId);
    if (!row) throw new BookingError("Turno inexistente");
    const { appointment, business, client, booking } = row;

    if (params.by === "client") {
      if (client.userId !== params.userId) throw new BookingError("Turno inexistente");
      if (!clientCanModify(appointment, business, now))
        throw new BookingError("Ya no es posible cancelar este turno online. Contactá al negocio.");
    } else if (appointment.businessId !== params.businessId) {
      throw new BookingError("Turno inexistente");
    }
    if (["cancelled", "expired"].includes(appointment.status)) throw new BookingError("El turno ya estaba cancelado");

    await tx
      .update(appointments)
      .set({ status: "cancelled", cancelledAt: now, cancelledBy: params.by, cancelReason: params.reason ?? null })
      .where(eq(appointments.id, appointment.id));

    if (booking) {
      const remaining = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.bookingId, booking.id),
            inArray(appointments.status, ["confirmed", "pending_payment", "completed", "no_show"]),
          ),
        );
      const unpaid = booking.status === "pending_payment" && booking.paidAmount === 0;
      if (!remaining.length) {
        await tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, booking.id));
        if (unpaid && booking.couponId) await releaseCouponUse(tx, booking.couponId);
      } else if (unpaid) {
        // Carrito sin pagar: se descuenta este turno del total y de la seña a cobrar.
        await tx
          .update(bookings)
          .set({
            subtotal: sql`${bookings.subtotal} - ${appointment.price}`,
            discount: sql`${bookings.discount} - ${appointment.discount}`,
            total: sql`${bookings.total} - ${appointment.price - appointment.discount}`,
            depositAmount: sql`greatest(${bookings.depositAmount} - ${appointment.depositAmount}, 0)`,
          })
          .where(eq(bookings.id, booking.id));
      }
    }

    const paid = booking?.paymentStatus === "approved" && appointment.depositAmount > 0;
    const shouldRefund = paid && (params.by === "client" ? refundApplies(appointment, business, now) : Boolean(params.refund));
    return { appointment, booking, shouldRefund };
  });

  let refunded = 0;
  if (result.shouldRefund && result.booking) {
    const ok = await refundBooking(result.booking.id, result.appointment.depositAmount).catch((err) => {
      console.error("[cancel] error al reembolsar", err);
      return false;
    });
    if (ok) refunded = result.appointment.depositAmount;
  }
  if (params.by === "client") {
    void notifyAppointmentEvent(params.appointmentId, "cancellation", refunded ? "Se devolvió la seña automáticamente" : undefined);
  }
  return { refunded };
}

export async function rescheduleAppointmentByClient(params: {
  appointmentId: string;
  userId: string;
  date: string;
  minutes: number;
}): Promise<void> {
  if (!isValidDateStr(params.date) || !Number.isInteger(params.minutes)) throw new BookingError("Horario inválido");
  const db = await getDb();
  const now = new Date();
  const previousStart = await db.transaction(async (tx) => {
    const row = await lockAppointment(tx, params.appointmentId, { professionals: true });
    if (!row || row.client.userId !== params.userId) throw new BookingError("Turno inexistente");
    const { appointment, business } = row;
    if (appointment.status !== "confirmed") throw new BookingError("Sólo se pueden modificar turnos confirmados");
    if (!clientCanModify(appointment, business, now))
      throw new BookingError("Ya no es posible modificar este turno online. Contactá al negocio.");
    if (appointment.clientEdits >= business.maxClientEdits)
      throw new BookingError("Alcanzaste la cantidad máxima de modificaciones para este turno");

    const ctx = await getSlotContext(tx, business.id, appointment, { onlineOnly: false });
    if (!ctx) throw new BookingError("El servicio ya no está disponible con este profesional");
    const ok = await isSlotBookable(tx, business, ctx, params.date, params.minutes, {
      now,
      excludeAppointmentIds: [appointment.id],
    });
    if (!ok) throw new BookingError("Ese horario ya no está disponible");

    const startsAt = zonedToUtc(params.date, params.minutes, business.timezone);
    await tx
      .update(appointments)
      .set({
        startsAt,
        endsAt: new Date(startsAt.getTime() + ctx.service.durationMinutes * 60_000),
        blockEndsAt: new Date(startsAt.getTime() + ctx.service.blockingMinutes * 60_000),
        clientEdits: appointment.clientEdits + 1,
        reminderSentAt: null,
      })
      .where(eq(appointments.id, appointment.id));
    return formatLongDateTime(appointment.startsAt, business.timezone);
  });
  void notifyAppointmentEvent(params.appointmentId, "reschedule", `Antes: ${previousStart}`);
}
