import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/panel-ui";
import { Alert } from "@/components/ui";
import { getDb } from "@/db";
import { professionalServices, professionals, services } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { ALL_WEEKDAYS } from "@/lib/schedule";
import { deleteServiceAction } from "../../actions";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Servicio" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ primero?: string }> };

export default async function ServiceEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { primero } = await searchParams;
  const { business } = await requireBusiness();
  const db = await getDb();
  const isNew = id === "nuevo";

  const [service] = isNew
    ? [null]
    : await db.select().from(services).where(and(eq(services.id, id), eq(services.businessId, business.id)));
  if (service === undefined) notFound();

  const pros = await db
    .select()
    .from(professionals)
    .where(eq(professionals.businessId, business.id))
    .orderBy(asc(professionals.order), asc(professionals.createdAt));
  const links = service
    ? await db.select().from(professionalServices).where(eq(professionalServices.serviceId, service.id))
    : [];

  return (
    <>
      <PageHeader
        title={service ? service.name : "Nuevo servicio"}
        actions={<Link href="/panel/servicios" className="text-sm underline">Volver</Link>}
      />
      {primero && (
        <div className="mb-5">
          <Alert tone="blue">¡Tu negocio está creado! Cargá tu primer servicio para que tus clientes puedan reservar.</Alert>
        </div>
      )}
      <ServiceForm
        service={service}
        first={Boolean(primero)}
        requireDeposit={business.requireDeposit}
        businessDepositPercent={business.depositPercent}
        professionals={pros.map((p) => {
          const link = links.find((l) => l.professionalId === p.id);
          return {
            id: p.id,
            name: `${p.firstName} ${p.lastName}`.trim() + (p.isActive ? "" : " (inactivo)"),
            assigned: Boolean(link),
            weekdays: link?.weekdays ?? ALL_WEEKDAYS,
          };
        })}
      />
      {service && (
        <form action={deleteServiceAction} className="mt-8 border-t border-neutral-200 pt-6">
          <input type="hidden" name="id" value={service.id} />
          <button className="text-sm text-red-600 underline">Eliminar servicio</button>
          <p className="mt-1 text-xs text-neutral-500">Si tiene turnos registrados se desactiva en lugar de borrarse.</p>
        </form>
      )}
    </>
  );
}
