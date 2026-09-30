import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { SiteFooter } from "@/components/site-footer";
import { getDb } from "@/db";
import { appointments, bookings, branches, businesses, clients, professionals } from "@/db/schema";
import { requireUser, getUserBusinesses } from "@/lib/auth";
import { clientCanModify, expireHolds, refundApplies } from "@/lib/bookings";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatMoney } from "@/lib/pricing";
import { formatLongDateTime } from "@/lib/time";
import { MyAppointmentCard, type MyAppointment } from "./appointment-card";

export const metadata: Metadata = { title: "Mis turnos" };

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export default async function MyAppointmentsPage() {
  const user = await requireUser("/mis-turnos");
  await expireHolds();
  const db = await getDb();
  const rows = await db
    .select({
      appointment: appointments,
      business: businesses,
      branch: branches,
      professional: professionals,
      booking: bookings,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(and(eq(clients.userId, user.id)))
    .orderBy(desc(appointments.startsAt))
    .limit(200);
  const managed = await getUserBusinesses(user.id);

  const now = new Date();
  const items: MyAppointment[] = rows
    .filter((r) => r.appointment.status !== "expired")
    .map(({ appointment: a, business: b, branch, professional, booking }) => ({
      id: a.id,
      bookingId: a.bookingId,
      slug: b.slug,
      businessName: b.name,
      primaryColor: b.primaryColor,
      serviceName: a.serviceName,
      professional: `${professional.firstName} ${professional.lastName}`.trim(),
      address: [branch.address, branch.city].filter(Boolean).join(", "),
      when: formatLongDateTime(a.startsAt, b.timezone),
      price: b.showPrices ? formatMoney(a.price - a.discount, b.currency) : null,
      deposit: a.depositAmount ? formatMoney(a.depositAmount, b.currency) : null,
      depositPaid: booking?.paymentStatus === "approved" || booking?.paymentStatus === "refunded",
      status: a.status,
      upcoming: a.startsAt > now && ["confirmed", "pending_payment"].includes(a.status),
      canModify: clientCanModify(a, b, now),
      canReschedule: a.status === "confirmed" && clientCanModify(a, b, now) && a.clientEdits < b.maxClientEdits,
      refundOnCancel: booking?.paymentStatus === "approved" && a.depositAmount > 0 && refundApplies(a, b, now),
      checkoutUrl: a.status === "pending_payment" ? (booking?.checkoutUrl ?? null) : null,
      whatsapp: b.whatsapp,
      googleCalendarUrl: googleCalendarUrl({
        title: `${a.serviceName} - ${b.name}`,
        start: a.startsAt,
        end: a.endsAt,
        location: [branch.address, branch.city].filter(Boolean).join(", "),
      }),
    }));
  const upcoming = items.filter((i) => i.upcoming).reverse();
  const past = items.filter((i) => !i.upcoming);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg">
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-white">
            {appName}
          </Link>
          <div className="flex items-center gap-3 text-sm text-white">
            <Link href="/cuenta" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
              Mi cuenta
            </Link>
            {managed.length > 0 && (
              <Link href="/panel" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
                Mi negocio
              </Link>
            )}
            <form action={logoutAction}>
              <button className="rounded-lg px-3 py-1.5 hover:bg-white/10">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Mis turnos</h1>
        <p className="text-sm text-neutral-600">
          {user.firstName} {user.lastName} · {user.email}
        </p>

        <h2 className="mt-8 text-lg font-bold">Próximos</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 rounded-xl bg-white p-4 text-sm text-neutral-600">No tenés turnos próximos.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {upcoming.map((a) => (
              <MyAppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-bold">Historial</h2>
            <div className="mt-3 space-y-3">
              {past.map((a) => (
                <MyAppointmentCard key={a.id} appointment={a} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
