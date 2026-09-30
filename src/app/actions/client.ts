"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, cancelAppointment, rescheduleAppointmentByClient } from "@/lib/bookings";

export type ActionResult = { ok?: boolean; error?: string; message?: string };

function toResult(err: unknown): ActionResult {
  if (err instanceof BookingError) return { error: err.message };
  console.error(err);
  return { error: "Ocurrió un error. Intentá nuevamente." };
}

export async function cancelMyAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión" };
  try {
    const { refunded } = await cancelAppointment({ appointmentId, by: "client", userId: user.id });
    revalidatePath("/mis-turnos");
    return { ok: true, message: refunded ? "Turno cancelado. Te devolvimos la seña." : "Turno cancelado." };
  } catch (err) {
    return toResult(err);
  }
}

export async function rescheduleMyAppointmentAction(
  appointmentId: string,
  date: string,
  minutes: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión" };
  try {
    await rescheduleAppointmentByClient({ appointmentId, userId: user.id, date, minutes });
    revalidatePath("/mis-turnos");
    return { ok: true, message: "Turno modificado." };
  } catch (err) {
    return toResult(err);
  }
}
