import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, type SessionUser } from "./auth";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ admin: users.isPlatformAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.admin ?? false;
}

/** Área de administración: para quien no es operador de la plataforma, la página "no existe". */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !(await isPlatformAdmin(user.id))) notFound();
  return user;
}
