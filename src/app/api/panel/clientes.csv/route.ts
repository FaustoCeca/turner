import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { businessForAction } from "@/lib/panel";

function csvCell(value: string | null | boolean): string {
  const s = value === null ? "" : String(value);
  // Evita inyección de fórmulas al abrir el archivo en Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  let business;
  try {
    ({ business } = await businessForAction());
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.select().from(clients).where(eq(clients.businessId, business.id)).orderBy(asc(clients.firstName));
  const header = ["Nombre", "Apellido", "Teléfono", "Email", "Notas", "Sin seña", "Bloqueado"];
  const lines = rows.map((c) =>
    [c.firstName, c.lastName, c.phone, c.email, c.notes, c.depositExempt, c.isBlocked].map(csvCell).join(","),
  );
  const body = "﻿" + [header.join(","), ...lines].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${business.slug}.csv"`,
    },
  });
}
