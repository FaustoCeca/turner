"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserBooking } from "@/lib/booking-view";
import { applyPaymentUpdate } from "@/lib/bookings";
import { env } from "@/lib/env";

/** Aprueba o rechaza el pago simulado de una reserva propia (sólo con pagos simulados habilitados). */
export async function mockPayAction(bookingId: string, formData: FormData): Promise<void> {
  if (!env.mp.mockEnabled) return;
  const user = await getCurrentUser();
  const data = user && (await getUserBooking(bookingId, user.id));
  if (!data || data.booking.paymentProvider !== "mock") return;
  const approve = formData.get("result") === "approved";
  await applyPaymentUpdate(bookingId, {
    provider: "mock",
    id: `mock-${bookingId}-${Date.now()}`,
    status: approve ? "approved" : "rejected",
    amount: data.booking.depositAmount,
  });
  redirect(`/${data.business.slug}/reserva/${bookingId}`);
}
