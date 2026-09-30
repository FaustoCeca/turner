import { NextResponse, type NextRequest } from "next/server";
import { expireHolds } from "@/lib/bookings";
import { env } from "@/lib/env";

/**
 * Limpieza diaria: libera reservas que no se pagaron a tiempo. (Las páginas también lo hacen al
 * cargarse, así que no depende de que el cron corra seguido.) Vercel envía "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await expireHolds();
  return NextResponse.json({ ok: true });
}
