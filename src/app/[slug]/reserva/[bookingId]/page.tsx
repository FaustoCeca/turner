import { CalendarPlus, CheckCircle2, Clock3, MapPin, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BusinessShell } from "@/components/business-shell";
import { getCurrentUser } from "@/lib/auth";
import { getUserBooking, syncMercadoPagoPayment } from "@/lib/booking-view";
import { expireHolds } from "@/lib/bookings";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatMoney } from "@/lib/pricing";
import { toPublicBusiness } from "@/lib/public";
import { formatLongDateTime } from "@/lib/time";

type Props = {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Tu reserva" };


export default async function BookingResultPage({ params, searchParams }: Props) {
  const { slug, bookingId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/${slug}/reserva/${bookingId}`)}`);

  const first = await getUserBooking(bookingId, user.id);
  if (!first || first.business.slug !== slug) notFound();
  // Sin cron frecuente: las reservas sin pagar se liberan al consultarlas.
  await expireHolds(first.business.id);

  const paymentId = [sp.payment_id, sp.collection_id].flat().find((v): v is string => typeof v === "string");
  if (first.booking.paymentProvider === "mercadopago" && first.booking.status !== "confirmed") {
    await syncMercadoPagoPayment(bookingId, paymentId);
  }
  const data = (await getUserBooking(bookingId, user.id))!;
  const { booking, business, items } = data;
  const money = (n: number) => formatMoney(n, business.currency);

  const header = (() => {
    if (booking.status === "confirmed")
      return {
        icon: <CheckCircle2 className="size-14 text-emerald-500" />,
        title: "¡Turno confirmado!",
        text: "Agregalo a tu calendario: te va a avisar un día antes y dos horas antes.",
      };
    if (booking.status === "pending_payment" && booking.paymentStatus === "pending" && booking.paymentId)
      return {
        icon: <Clock3 className="size-14 text-amber-500" />,
        title: "Pago pendiente de acreditación",
        text: "Guardamos tu turno hasta que se acredite el pago. Volvé a esta página o a “Mis turnos” para ver la confirmación.",
      };
    if (booking.status === "pending_payment")
      return {
        icon: <Clock3 className="size-14 text-amber-500" />,
        title: booking.paymentStatus === "rejected" ? "El pago fue rechazado" : "Falta abonar la seña",
        text: `Tu turno queda reservado hasta las ${booking.holdExpiresAt ? formatLongDateTime(booking.holdExpiresAt, business.timezone).split(", ")[1] : ""}. Aboná la seña para confirmarlo.`,
      };
    if (booking.status === "expired")
      return {
        icon: <XCircle className="size-14 text-red-500" />,
        title: "La reserva venció",
        text: "No registramos el pago de la seña a tiempo y el horario se liberó.",
      };
    return {
      icon: <XCircle className="size-14 text-red-500" />,
      title: "Reserva cancelada",
      text: booking.refundedAmount ? `Se devolvieron ${money(booking.refundedAmount)} al medio de pago original.` : "",
    };
  })();

  return (
    <BusinessShell business={toPublicBusiness(business)} user={user} subtitle="Tu reserva">
      <div className="mx-auto max-w-[480px] px-4 py-10">
        <div className="flex flex-col items-center text-center">
          {header.icon}
          <h1 className="mt-3 text-2xl font-bold">{header.title}</h1>
          {header.text && <p className="mt-2 text-neutral-600">{header.text}</p>}
        </div>

        <div className="mt-8 space-y-3">
          {items.map(({ appointment: a, branch, professional, notes }) => (
            <div key={a.id} className="rounded-xl border-2 border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{a.serviceName}</p>
                  <p className="text-sm text-neutral-600">con {professional.firstName} {professional.lastName}</p>
                </div>
                {business.showPrices && <p className="font-bold text-brand">{money(a.price - a.discount)}</p>}
              </div>
              <p className="mt-2 text-[15px] first-letter:uppercase">{formatLongDateTime(a.startsAt, business.timezone)}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-neutral-600">
                <MapPin className="size-4" /> {[branch.address, branch.city].filter(Boolean).join(", ")}
              </p>
              {notes && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-neutral-50 p-3 text-sm">
                  <b>A tener en cuenta:</b> {notes}
                </p>
              )}
              {booking.status === "confirmed" && (
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <a
                    href={googleCalendarUrl({
                      title: `${a.serviceName} - ${business.name}`,
                      start: a.startsAt,
                      end: a.endsAt,
                      location: [branch.address, branch.city].filter(Boolean).join(", "),
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    <CalendarPlus className="size-4" /> Google Calendar
                  </a>
                  <a href={`/api/turnos/${a.id}/calendario`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5">
                    <CalendarPlus className="size-4" /> iPhone / Outlook
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        <dl className="mt-6 space-y-1 rounded-xl bg-white p-4 text-sm">
          {booking.discount > 0 && (
            <div className="flex justify-between">
              <dt>Descuento</dt>
              <dd>−{money(booking.discount)}</dd>
            </div>
          )}
          {business.showPrices && (
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd>{money(booking.total)}</dd>
            </div>
          )}
          {booking.depositAmount > 0 && (
            <div className="flex justify-between">
              <dt>Seña {booking.paymentStatus === "approved" || booking.paymentStatus === "refunded" ? "abonada" : "a abonar"}</dt>
              <dd>{money(booking.depositAmount)}</dd>
            </div>
          )}
          {booking.depositAmount > 0 && booking.paymentStatus === "approved" && business.showPrices && (
            <div className="flex justify-between text-neutral-600">
              <dt>Resta abonar en el local</dt>
              <dd>{money(Math.max(0, booking.total - booking.depositAmount))}</dd>
            </div>
          )}
        </dl>

        <div className="mt-8 flex flex-col gap-3">
          {booking.status === "pending_payment" && booking.checkoutUrl && !(booking.paymentStatus === "pending" && booking.paymentId) && (
            <a href={booking.checkoutUrl} className="rounded-lg bg-brand py-3 text-center font-medium text-white">
              {booking.paymentStatus === "rejected" ? "Reintentar pago" : `Abonar seña (${money(booking.depositAmount)})`}
            </a>
          )}
          {(booking.status === "expired" || booking.status === "cancelled") && (
            <Link href={`/${business.slug}`} className="rounded-lg bg-brand py-3 text-center font-medium text-white">
              Reservar un nuevo turno
            </Link>
          )}
          <Link href="/mis-turnos" className="rounded-lg border border-neutral-300 bg-white py-3 text-center font-medium">
            Ver mis turnos
          </Link>
        </div>
      </div>
    </BusinessShell>
  );
}
