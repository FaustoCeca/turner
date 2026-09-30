import { and, count, desc, eq, ilike, max, or, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { appointments, clients } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { formatInTz } from "@/lib/time";
import { NewClientButton } from "./new-client-button";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { business } = await requireBusiness();
  const db = await getDb();
  const term = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const rows = await db
    .select({ client: clients, visits: count(appointments.id), last: max(appointments.startsAt) })
    .from(clients)
    .leftJoin(appointments, and(eq(appointments.clientId, clients.id), eq(appointments.status, "completed")))
    .where(
      and(
        eq(clients.businessId, business.id),
        term
          ? or(ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, term), ilike(clients.phone, term), ilike(clients.email, term))
          : undefined,
      ),
    )
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Se agregan solos cuando reservan online. También podés cargarlos a mano."
        actions={
          <>
            <a href="/api/panel/clientes.csv" className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium">
              <Download className="size-4" /> Exportar
            </a>
            <NewClientButton />
          </>
        }
      />
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email"
          className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </form>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Visitas</th>
              <th className="px-4 py-3">Última visita</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  {q ? "Sin resultados." : "Todavía no tenés clientes."}
                </td>
              </tr>
            )}
            {rows.map(({ client: c, visits, last }) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/panel/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {c.phone}
                  {c.phone && c.email && <br />}
                  {c.email}
                </td>
                <td className="px-4 py-3">{visits}</td>
                <td className="px-4 py-3">{last ? formatInTz(new Date(last), business.timezone, "d/MM/yyyy") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  {c.depositExempt && <Badge tone="brand">Sin seña</Badge>} {c.isBlocked && <Badge tone="red">Bloqueado</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
