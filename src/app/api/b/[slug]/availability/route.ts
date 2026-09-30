import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { getBusinessBySlug } from "@/lib/bookings";
import { getAvailability, getSlotContext } from "@/lib/slots";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams;
  const serviceId = q.get("serviceId");
  const professionalId = q.get("professionalId");
  const branchId = q.get("branchId");
  if (!serviceId || !professionalId || !branchId) {
    return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
  }

  const db = await getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) return NextResponse.json({ error: "Negocio inexistente" }, { status: 404 });

  const ctx = await getSlotContext(db, business.id, { serviceId, professionalId, branchId }, { onlineOnly: true });
  if (!ctx) return NextResponse.json({ error: "El profesional no presta este servicio" }, { status: 404 });

  const days = await getAvailability(db, business, ctx);
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
