import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { getBusinessBySlug } from "@/lib/bookings";
import { getProfessionalsForService } from "@/lib/slots";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!serviceId) return NextResponse.json({ error: "Falta el servicio" }, { status: 400 });

  const db = await getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) return NextResponse.json({ error: "Negocio inexistente" }, { status: 404 });

  const groups = await getProfessionalsForService(db, business.id, serviceId);
  return NextResponse.json({ groups });
}
