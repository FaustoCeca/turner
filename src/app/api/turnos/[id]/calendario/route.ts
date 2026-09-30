import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { appointments, branches, businesses, clients, professionals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { buildIcs } from "@/lib/calendar";
import { env } from "@/lib/env";

/** Descarga .ics de un turno propio (se abre directo en el calendario del celular). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión" }, { status: 401 });

  const db = await getDb();
  const [row] = await db
    .select({ a: appointments, business: businesses, branch: branches, pro: professionals, clientUserId: clients.userId })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, id))
    .limit(1);
  if (!row || row.clientUserId !== user.id) return NextResponse.json({ error: "Turno inexistente" }, { status: 404 });

  const ics = buildIcs(
    [
      {
        uid: `${row.a.id}@${new URL(env.appUrl).host}`,
        title: `${row.a.serviceName} - ${row.business.name}`,
        start: row.a.startsAt,
        end: row.a.endsAt,
        location: [row.branch.address, row.branch.city].filter(Boolean).join(", "),
        description: `Con ${row.pro.firstName} ${row.pro.lastName}. Para cancelar o cambiar: ${env.appUrl}/mis-turnos`,
        url: `${env.appUrl}/mis-turnos`,
      },
    ],
    env.appName,
  );
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="turno-${row.business.slug}.ics"`,
    },
  });
}
