"use server";

import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, businessMembers, clients, sessions, users } from "@/db/schema";
import { currentSessionId, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isValidPhone } from "@/lib/whatsapp";

export type AccountState = { ok?: boolean; error?: string; message?: string };

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá tu nombre").max(60),
  lastName: z.string().trim().min(1, "Ingresá tu apellido").max(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(isValidPhone, "Ingresá tu teléfono con código de área (ej. 341 555 1234)"),
});

/** Actualiza los datos del usuario y también su ficha en cada negocio donde reservó. */
export async function updateProfileAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión" };
  const parsed = profileSchema.safeParse({
    firstName: fd.get("firstName") ?? user.firstName,
    lastName: fd.get("lastName") ?? user.lastName,
    phone: fd.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await getDb();
  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  // El cliente es la fuente de verdad de su contacto: los negocios ven el teléfono actualizado.
  await db.update(clients).set(parsed.data).where(eq(clients.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Datos guardados" };
}

export async function changePasswordAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión" };
  const next = String(fd.get("newPassword") ?? "");
  if (next.length < 8) return { error: "La contraseña nueva debe tener al menos 8 caracteres" };
  if (!(await rateLimit(`password:${user.id}`, 5, 15 * 60_000))) return { error: "Demasiados intentos. Probá más tarde." };

  const db = await getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(String(fd.get("currentPassword") ?? ""), row.hash))) {
    return { error: "La contraseña actual no es correcta" };
  }
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // Se cierran las otras sesiones abiertas (otros dispositivos); ésta sigue activa.
  const current = await currentSessionId();
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), current ? ne(sessions.id, current) : undefined));
  return { ok: true, message: "Contraseña actualizada. Cerramos la sesión en tus otros dispositivos." };
}

export async function deleteAccountAction(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión" };
  if (!(await rateLimit(`delete:${user.id}`, 5, 15 * 60_000))) return { error: "Demasiados intentos. Probá más tarde." };
  const db = await getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(String(fd.get("password") ?? ""), row.hash))) {
    return { error: "La contraseña no es correcta" };
  }

  const [member] = await db.select({ id: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, user.id)).limit(1);
  if (member) return { error: "Administrás un negocio: no se puede eliminar la cuenta desde acá. Escribinos para darlo de baja." };

  const [upcoming] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(clients.userId, user.id),
        gt(appointments.startsAt, new Date()),
        inArray(appointments.status, ["confirmed", "pending_payment"]),
      ),
    )
    .limit(1);
  if (upcoming) return { error: "Tenés turnos próximos. Cancelalos desde “Mis turnos” antes de eliminar la cuenta." };

  // Los negocios conservan su historial de turnos (la ficha del cliente queda sin cuenta vinculada).
  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();
  redirect("/");
}
