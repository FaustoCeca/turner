import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, type DB } from "@/db";
import {
  appointments,
  bookings,
  branches,
  businesses,
  clients,
  coupons,
  notifications,
  payments,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  users,
} from "@/db/schema";
import type { SessionUser } from "./auth";
import { applyPaymentUpdate, cancelAppointment, createOnlineBooking, expireHolds } from "./bookings";
import { addDays, todayIn } from "./time";

const TZ = "America/Argentina/Buenos_Aires";
const tomorrow = addDays(todayIn(TZ), 1);

let db: DB;
let client: SessionUser;
let ownerId: string;
let ctx: { slug: string; serviceId: string; proA: string; proB: string; branchId: string; businessId: string };

async function createUser(email: string, phone: string | null = "341 555 0000"): Promise<SessionUser> {
  const [u] = await db.insert(users).values({ email, passwordHash: "x", firstName: "Test", lastName: email, phone }).returning();
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone };
}

const allDay = Array.from({ length: 7 }, () => ({ enabled: true, ranges: [{ start: 8 * 60, end: 20 * 60 }] }));

beforeAll(async () => {
  db = await getDb();
  client = await createUser("cliente@test.dev");
  ownerId = (await createUser("owner@test.dev")).id;
  const [business] = await db
    .insert(businesses)
    // Sin límite de turnos por cliente: el límite tiene su propio test.
    .values({ slug: "test-biz", name: "Test", ownerId, requireDeposit: true, depositPercent: 50, maxDaysInFuture: 30, maxActiveBookingsPerClient: 0 })
    .returning();
  const [branch] = await db.insert(branches).values({ businessId: business.id, address: "Calle 1" }).returning();
  const [service] = await db
    .insert(services)
    .values({ businessId: business.id, name: "Corte", price: 10000, durationMinutes: 30, blockingMinutes: 30 })
    .returning();
  const pros = await db
    .insert(professionals)
    .values([
      { businessId: business.id, firstName: "A" },
      { businessId: business.id, firstName: "B" },
    ])
    .returning();
  for (const p of pros) {
    await db.insert(professionalBranches).values({ professionalId: p.id, branchId: branch.id, schedule: allDay });
    await db.insert(professionalServices).values({ professionalId: p.id, serviceId: service.id });
  }
  ctx = { slug: business.slug, serviceId: service.id, proA: pros[0].id, proB: pros[1].id, branchId: branch.id, businessId: business.id };
});

function item(minutes: number, professionalId = ctx.proA) {
  return { serviceId: ctx.serviceId, professionalId, branchId: ctx.branchId, date: tomorrow, minutes };
}

async function booking(id: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
  return b;
}

const approved = (id: string, amount: number) => ({ provider: "mock" as const, id, status: "approved", amount });

describe("reservas y pagos", () => {
  it("dos reservas del mismo horario: sólo una se crea", async () => {
    const results = await Promise.allSettled([
      createOnlineBooking({ slug: ctx.slug, user: client, items: [item(9 * 60)] }),
      createOnlineBooking({ slug: ctx.slug, user: client, items: [item(9 * 60)] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("confirma con el pago y los reintentos del mismo pago no hacen nada", async () => {
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(10 * 60)] });
    expect((await booking(bookingId)).depositAmount).toBe(5000);
    await applyPaymentUpdate(bookingId, approved("pay-1", 5000));
    await applyPaymentUpdate(bookingId, approved("pay-1", 5000));
    const b = await booking(bookingId);
    expect(b.status).toBe("confirmed");
    expect(b.refundedAmount).toBe(0);
  });

  it("un reintento del webhook no devuelve la seña que el negocio decidió retener", async () => {
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(11 * 60)] });
    await applyPaymentUpdate(bookingId, approved("pay-2", 5000));
    const [a] = await db.select().from(appointments).where(eq(appointments.bookingId, bookingId));
    await cancelAppointment({ appointmentId: a.id, by: "business", userId: ownerId, businessId: ctx.businessId, refund: false });
    await applyPaymentUpdate(bookingId, approved("pay-2", 5000));
    const b = await booking(bookingId);
    expect(b.status).toBe("cancelled");
    expect(b.refundedAmount).toBe(0);
  });

  it("un segundo pago aprobado para una reserva ya paga se devuelve", async () => {
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(12 * 60)] });
    await applyPaymentUpdate(bookingId, approved("pay-3", 5000));
    await applyPaymentUpdate(bookingId, approved("pay-3-dup", 5000));
    const [dup] = await db.select().from(payments).where(eq(payments.externalId, "pay-3-dup"));
    expect(dup.status).toBe("refunded");
    expect((await booking(bookingId)).refundedAmount).toBe(0);
  });

  it("un pago que llega después del turno no lo confirma: se devuelve", async () => {
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(13 * 60)] });
    const past = new Date(Date.now() - 3_600_000);
    await db.update(bookings).set({ holdExpiresAt: past }).where(eq(bookings.id, bookingId));
    await db.update(appointments).set({ startsAt: past, endsAt: past, blockEndsAt: past }).where(eq(appointments.bookingId, bookingId));
    await expireHolds();
    await applyPaymentUpdate(bookingId, approved("pay-4", 5000));
    const b = await booking(bookingId);
    expect(b.status).toBe("cancelled");
    expect(b.refundedAmount).toBe(5000);
  });

  it("cancelar un ítem del carrito antes de pagar baja la seña y el excedente se devuelve", async () => {
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(14 * 60), item(14 * 60, ctx.proB)] });
    expect((await booking(bookingId)).depositAmount).toBe(10000);
    const [first] = await db.select().from(appointments).where(eq(appointments.bookingId, bookingId));
    await cancelAppointment({ appointmentId: first.id, by: "client", userId: client.id });
    expect((await booking(bookingId)).depositAmount).toBe(5000);
    await applyPaymentUpdate(bookingId, approved("pay-5", 10000));
    const b = await booking(bookingId);
    expect(b.status).toBe("confirmed");
    expect(b.refundedAmount).toBe(5000);
  });

  it("respeta el máximo de usos del cupón aunque las reservas no estén pagas", async () => {
    await db.insert(coupons).values({ businessId: ctx.businessId, code: "UNO", discountType: "percent", value: 10, maxUses: 1 });
    await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(15 * 60)], couponCode: "UNO" });
    await expect(createOnlineBooking({ slug: ctx.slug, user: client, items: [item(16 * 60)], couponCode: "UNO" })).rejects.toThrow(
      /usos disponibles/,
    );
  });

  it("avisa al negocio en Novedades cuando se confirma una reserva y cuando el cliente cancela", async () => {
    const before = await db.select().from(notifications).where(eq(notifications.businessId, ctx.businessId));
    const { bookingId } = await createOnlineBooking({ slug: ctx.slug, user: client, items: [item(17 * 60)] });
    await applyPaymentUpdate(bookingId, approved("pay-6", 5000));
    const [a] = await db.select().from(appointments).where(eq(appointments.bookingId, bookingId));
    await cancelAppointment({ appointmentId: a.id, by: "client", userId: client.id });
    // Los avisos se guardan sin bloquear la respuesta: esperamos a que terminen.
    await new Promise((r) => setTimeout(r, 200));
    const after = await db.select().from(notifications).where(eq(notifications.businessId, ctx.businessId));
    const fresh = after.filter((n) => !before.some((b) => b.id === n.id));
    expect(fresh.map((n) => n.kind).sort()).toEqual(["booking", "cancellation"]);
    expect(fresh.find((n) => n.kind === "booking")?.body).toContain("Seña cobrada");
  });

  it("no deja reservar sin teléfono (sin emails, es el único canal de contacto)", async () => {
    const noPhone = await createUser("sin-telefono@test.dev", null);
    await expect(createOnlineBooking({ slug: ctx.slug, user: noPhone, items: [item(18 * 60)] })).rejects.toThrow(/teléfono/);
  });

  it("limita los turnos futuros por cliente", async () => {
    await db.update(businesses).set({ maxActiveBookingsPerClient: 2 }).where(eq(businesses.id, ctx.businessId));
    const limited = await createUser("limite@test.dev");
    try {
      await createOnlineBooking({ slug: ctx.slug, user: limited, items: [item(8 * 60, ctx.proB), item(8 * 60 + 30, ctx.proB)] });
      await expect(createOnlineBooking({ slug: ctx.slug, user: limited, items: [item(9 * 60, ctx.proB)] })).rejects.toThrow(/máximo/);
      await expect(
        createOnlineBooking({ slug: ctx.slug, user: await createUser("limite2@test.dev"), items: [item(10 * 60, ctx.proB), item(10 * 60 + 30, ctx.proB), item(11 * 60, ctx.proB)] }),
      ).rejects.toThrow(/hasta 2 turnos/);
    } finally {
      await db.update(businesses).set({ maxActiveBookingsPerClient: 0 }).where(eq(businesses.id, ctx.businessId));
    }
  });

  it("la ficha de cliente se crea una sola vez", async () => {
    const rows = await db.select().from(clients).where(eq(clients.userId, client.id));
    expect(rows).toHaveLength(1);
  });
});
