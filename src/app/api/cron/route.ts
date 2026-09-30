import { lt, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { expireHolds } from "@/lib/bookings";
import { env } from "@/lib/env";
import { cleanupRateLimits } from "@/lib/rate-limit";

/**
 * Limpieza diaria: libera reservas que no se pagaron a tiempo (las páginas también lo hacen al cargarse),
 * borra sesiones vencidas, contadores de intentos viejos e imágenes huérfanas. Vercel envía "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = await getDb();
  await expireHolds();
  const expired = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  await cleanupRateLimits();
  // Imágenes subidas pero nunca guardadas en un logo o una foto.
  await db.execute(sql`
    delete from images i
    where i.created_at < now() - interval '1 day'
      and not exists (select 1 from businesses b where b.logo_url = '/api/imagenes/' || i.id)
      and not exists (select 1 from professionals p where p.avatar_url = '/api/imagenes/' || i.id)
  `);
  return NextResponse.json({ ok: true, expiredSessions: expired.length });
}
