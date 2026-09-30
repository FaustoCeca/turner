"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  normalizeEmail,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } from "@/lib/recovery";

export type AuthState = {
  error?: string;
  ok?: boolean;
  user?: SessionUser;
  message?: string;
  /** Código de recuperación recién generado: se muestra una única vez. */
  recoveryCode?: string;
};

/** Sólo rutas internas, para evitar redirecciones abiertas. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

const loginSchema = z.object({
  email: z.email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = normalizeEmail(parsed.data.email);

  if (!rateLimit(`login:${email}`, 8, 15 * 60_000) || !rateLimit(`login-ip:${await clientIp()}`, 30, 15 * 60_000)) {
    return { error: "Demasiados intentos. Esperá unos minutos y volvé a probar." };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }
  await createSession(user.id);

  const next = safeNext(formData.get("next"));
  if (next) redirect(next);
  return {
    ok: true,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone },
  };
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Ingresá tu nombre").max(60),
  lastName: z.string().trim().min(1, "Ingresá tu apellido").max(60),
  email: z.email("Ingresá un email válido"),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/, "Teléfono inválido")
    .optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!rateLimit(`register-ip:${await clientIp()}`, 10, 60 * 60_000)) {
    return { error: "Demasiados registros desde esta conexión. Probá más tarde." };
  }

  const db = await getDb();
  const email = normalizeEmail(parsed.data.email);
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return { error: "Ya existe una cuenta con ese email. Iniciá sesión." };

  const recoveryCode = generateRecoveryCode();
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(parsed.data.password),
      recoveryCodeHash: await hashRecoveryCode(recoveryCode),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone || null,
    })
    .returning();
  await createSession(user.id);

  // No redirige: el formulario muestra el código de recuperación y después continúa.
  return {
    ok: true,
    recoveryCode,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone },
  };
}

export async function logoutAction(formData: FormData): Promise<void> {
  await destroySession();
  redirect(safeNext(formData.get("next")) ?? "/");
}

/** "Olvidé mi contraseña": email + código de recuperación → nueva contraseña (y nuevo código). */
export async function resetWithRecoveryCodeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      email: z.email("Ingresá un email válido"),
      code: z.string().trim().min(1, "Ingresá tu código de recuperación"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
    })
    .safeParse({ email: formData.get("email"), code: formData.get("code"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = normalizeEmail(parsed.data.email);
  if (!rateLimit(`recover:${email}`, 5, 15 * 60_000) || !rateLimit(`recover-ip:${await clientIp()}`, 20, 15 * 60_000)) {
    return { error: "Demasiados intentos. Esperá unos minutos y volvé a probar." };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user?.recoveryCodeHash ? await verifyRecoveryCode(parsed.data.code, user.recoveryCodeHash) : false;
  if (!user || !valid) return { error: "El email o el código de recuperación no son correctos" };

  // El código se consume: se entrega uno nuevo y se cierran las sesiones abiertas.
  const recoveryCode = generateRecoveryCode();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), recoveryCodeHash: await hashRecoveryCode(recoveryCode) })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await createSession(user.id);
  return { ok: true, recoveryCode, message: "Listo, ya tenés tu nueva contraseña." };
}

/** Genera un código nuevo (invalida el anterior). Pide la contraseña actual. */
export async function regenerateRecoveryCodeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) return { error: "Iniciá sesión" };
  if (!rateLimit(`regen:${current.id}`, 5, 15 * 60_000)) return { error: "Demasiados intentos. Probá más tarde." };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!user || !(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { error: "La contraseña no es correcta" };
  }
  const recoveryCode = generateRecoveryCode();
  await db.update(users).set({ recoveryCodeHash: await hashRecoveryCode(recoveryCode) }).where(eq(users.id, user.id));
  return { ok: true, recoveryCode };
}
