import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { sha256 } from "./crypto";

/**
 * Cuenta un intento y devuelve true si sigue dentro del límite (`max` intentos cada `windowMs`).
 * Vive en la base, así que vale para todas las instancias de Vercel. Es un solo UPSERT atómico.
 * La clave (email, IP) se guarda hasheada.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = await getDb();
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const [row] = await db
    .insert(rateLimits)
    .values({ key: sha256(key), count: 1, resetAt: new Date(resetAt) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then ${resetAt}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= max;
}

/** Borra contadores vencidos (lo llama el cron diario). */
export async function cleanupRateLimits(): Promise<void> {
  const db = await getDb();
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
}
