"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";

/**
 * Rescate de cuenta: genera un código de recuperación nuevo para que el operador se lo pase al usuario
 * (por WhatsApp). Con ese código el usuario crea su contraseña en /recuperar.
 */
export async function adminResetRecoveryCodeAction(userId: string): Promise<{ code?: string; error?: string }> {
  const admin = await getCurrentUser();
  if (!admin || !(await isPlatformAdmin(admin.id))) return { error: "No autorizado" };
  const db = await getDb();
  const [target] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Usuario inexistente" };
  const code = generateRecoveryCode();
  await db.update(users).set({ recoveryCodeHash: await hashRecoveryCode(code) }).where(eq(users.id, target.id));
  console.info(`[admin] ${admin.email} generó un código de recuperación para ${target.email}`);
  return { code };
}
