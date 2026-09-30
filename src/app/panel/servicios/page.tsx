import { and, asc, count, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { professionalServices, professionals, services } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const { business } = await requireBusiness();
  const db = await getDb();
  const rows = await db
    .select({ service: services, pros: count(professionals.id) })
    .from(services)
    .leftJoin(professionalServices, eq(professionalServices.serviceId, services.id))
    .leftJoin(professionals, and(eq(professionals.id, professionalServices.professionalId), eq(professionals.isActive, true)))
    .where(eq(services.businessId, business.id))
    .groupBy(services.id)
    .orderBy(asc(services.order), asc(services.createdAt));

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lo que tus clientes pueden reservar: precio, duración, seña y quién lo presta."
        actions={
          <Link href="/panel/servicios/nuevo" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            <Plus className="size-4" /> Nuevo servicio
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="font-medium">Todavía no cargaste servicios</p>
          <p className="mt-1 text-sm text-neutral-600">Creá el primero para empezar a recibir reservas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Seña</th>
                <th className="px-4 py-3">Profesionales</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ service: s, pros }) => (
                <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/panel/servicios/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {s.modality}
                      {s.category && ` · ${s.category}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">{s.priceTBD ? "A definir" : formatMoney(s.price, business.currency)}</td>
                  <td className="px-4 py-3">
                    {s.durationMinutes} min
                    {s.blockingMinutes !== s.durationMinutes && <span className="text-xs text-neutral-500"> (bloquea {s.blockingMinutes})</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!business.requireDeposit || !s.depositEnabled ? "—" : `${s.depositPercent ?? business.depositPercent}%`}
                  </td>
                  <td className="px-4 py-3">{pros || <span className="text-amber-700">Sin asignar</span>}</td>
                  <td className="px-4 py-3">
                    {!s.isActive ? <Badge tone="neutral">Inactivo</Badge> : !s.isOnline ? <Badge tone="yellow">Sólo panel</Badge> : <Badge tone="green">Online</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
