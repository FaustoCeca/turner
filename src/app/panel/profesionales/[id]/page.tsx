import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/panel-ui";
import { getDb } from "@/db";
import { branches, professionalBranches, professionalServices, professionals, services, timeBlocks } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { ALL_WEEKDAYS } from "@/lib/schedule";
import { formatInTz } from "@/lib/time";
import { deleteBlockAction, deleteProfessionalAction } from "../../actions";
import { BlockForm } from "../../block-form";
import { ProfessionalForm } from "../professional-form";

export const metadata: Metadata = { title: "Profesional" };

export default async function ProfessionalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const db = await getDb();
  const isNew = id === "nuevo";

  const [pro] = isNew
    ? [null]
    : await db.select().from(professionals).where(and(eq(professionals.id, id), eq(professionals.businessId, business.id)));
  if (pro === undefined) notFound();

  const [branchRows, serviceRows, pbs, pss, blocks] = await Promise.all([
    db.select().from(branches).where(eq(branches.businessId, business.id)).orderBy(asc(branches.order), asc(branches.createdAt)),
    db.select().from(services).where(eq(services.businessId, business.id)).orderBy(asc(services.order), asc(services.createdAt)),
    pro ? db.select().from(professionalBranches).where(eq(professionalBranches.professionalId, pro.id)) : [],
    pro ? db.select().from(professionalServices).where(eq(professionalServices.professionalId, pro.id)) : [],
    pro
      ? db
          .select()
          .from(timeBlocks)
          .where(
            and(
              eq(timeBlocks.businessId, business.id),
              or(eq(timeBlocks.professionalId, pro.id), isNull(timeBlocks.professionalId)),
              gt(timeBlocks.endsAt, new Date()),
            ),
          )
          .orderBy(asc(timeBlocks.startsAt))
      : [],
  ]);

  const branchLabel = (b: (typeof branchRows)[number]) => (b.name ? `${b.name} (${b.address})` : b.address);
  const fmt = (d: Date) => formatInTz(d, business.timezone, "EEE d/MM HH:mm");

  return (
    <>
      <PageHeader
        title={pro ? `${pro.firstName} ${pro.lastName}`.trim() : "Nuevo profesional"}
        actions={<Link href="/panel/profesionales" className="text-sm underline">Volver</Link>}
      />
      <ProfessionalForm
        key={pro?.id ?? "new"}
        professional={pro}
        branches={branchRows.map((b) => ({ id: b.id, label: branchLabel(b) }))}
        schedules={Object.fromEntries(pbs.map((pb) => [pb.branchId, pb.schedule]))}
        services={serviceRows.map((s) => {
          const link = pss.find((ps) => ps.serviceId === s.id);
          return { id: s.id, name: s.name, assigned: Boolean(link), weekdays: link?.weekdays ?? ALL_WEEKDAYS };
        })}
      />

      {pro && (
        <div className="mt-5">
          <Section title="Bloqueos de agenda" description="Vacaciones, licencias o trámites: en esos horarios no se podrán reservar turnos.">
            {blocks.length > 0 && (
              <ul className="mb-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <b>{fmt(b.startsAt)}</b> → <b>{fmt(b.endsAt)}</b>
                      {b.reason && ` · ${b.reason}`}
                      {!b.professionalId && <span className="text-neutral-500"> (todo el negocio)</span>}
                    </span>
                    <form action={deleteBlockAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-xs text-red-600 underline">Quitar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <BlockForm professionals={[{ id: pro.id, name: `${pro.firstName} ${pro.lastName}` }]} branches={[]} fixedProfessionalId={pro.id} />
          </Section>
          <form action={deleteProfessionalAction} className="mt-8 border-t border-neutral-200 pt-6">
            <input type="hidden" name="id" value={pro.id} />
            <button className="text-sm text-red-600 underline">Eliminar profesional</button>
            <p className="mt-1 text-xs text-neutral-500">Si tiene turnos registrados se desactiva en lugar de borrarse.</p>
          </form>
        </div>
      )}
    </>
  );
}
