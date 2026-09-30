import { FlaskConical } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getUserBooking } from "@/lib/booking-view";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/pricing";
import { mockPayAction } from "../actions";

type Props = { params: Promise<{ bookingId: string }> };

/** Checkout de prueba para desarrollar sin credenciales de Mercado Pago. Deshabilitado en producción. */
export default async function MockCheckoutPage({ params }: Props) {
  if (!env.mp.mockEnabled) notFound();
  const { bookingId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/pago-simulado/${bookingId}`);
  const data = await getUserBooking(bookingId, user.id);
  if (!data || data.booking.paymentProvider !== "mock") notFound();
  const { booking, business } = data;
  const back = `/${business.slug}/reserva/${booking.id}`;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#ededed] p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
        <div className="flex items-center gap-2 text-amber-700">
          <FlaskConical className="size-5" />
          <p className="text-sm font-bold uppercase">Pago simulado (modo prueba)</p>
        </div>
        <p className="mt-4 text-neutral-600">Seña para {business.name}</p>
        <p className="text-3xl font-bold">{formatMoney(booking.depositAmount, business.currency)}</p>
        {booking.status !== "pending_payment" ? (
          <a href={back} className="mt-6 block rounded-lg bg-[#009ee3] py-3 text-center font-medium text-white">
            Volver a la reserva
          </a>
        ) : (
          <form action={mockPayAction.bind(null, booking.id)} className="mt-6 space-y-3">
            <SubmitButton name="result" value="approved" className="w-full bg-[#009ee3]">
              Pagar (aprobado)
            </SubmitButton>
            <SubmitButton name="result" value="rejected" variant="secondary" className="w-full">
              Simular pago rechazado
            </SubmitButton>
          </form>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          Para cobrar de verdad, el negocio debe conectar su cuenta de Mercado Pago en Configuración.
        </p>
      </div>
    </div>
  );
}
