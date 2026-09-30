import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { appointments, businesses, clients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAvailability, getSlotContext } from "@/lib/slots";

/** Horarios disponibles para reprogramar un turno propio (mismo servicio, profesional y sucursal). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión" }, { status: 401 });

  const db = await getDb();
  const [row] = await db
    .select({ appointment: appointments, business: businesses, clientUserId: clients.userId })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, id))
    .limit(1);
  if (!row || row.clientUserId !== user.id) return NextResponse.json({ error: "Turno inexistente" }, { status: 404 });

  const ctx = await getSlotContext(db, row.business.id, row.appointment);
  if (!ctx) return NextResponse.json({ error: "El servicio ya no está disponible" }, { status: 404 });
  const days = await getAvailability(db, row.business, ctx, { excludeAppointmentIds: [id] });
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
