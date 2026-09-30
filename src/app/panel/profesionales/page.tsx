import { asc, eq, inArray } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { Avatar, Badge } from "@/components/ui";
import { getDb } from "@/db";
import { branches, professionalBranches, professionalServices, professionals } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { describeDay, WEEKDAYS_SHORT } from "@/lib/schedule";

export const metadata: Metadata = { title: "Profesionales" };

export default async function ProfessionalsPage() {
  const { business } = await requireBusiness();
  const db = await getDb();
  const pros = await db
    .select()
    .from(professionals)
    .where(eq(professionals.businessId, business.id))
    .orderBy(asc(professionals.order), asc(professionals.createdAt));
  const ids = pros.map((p) => p.id);
  const assignments = ids.length
    ? await db
        .select({ pb: professionalBranches, branch: branches })
        .from(professionalBranches)
        .innerJoin(branches, eq(branches.id, professionalBranches.branchId))
        .where(inArray(professionalBranches.professionalId, ids))
    : [];
  const serviceCounts = ids.length
    ? await db.select().from(professionalServices).where(inArray(professionalServices.professionalId, ids))
    : [];

  return (
    <>
      <PageHeader
        title="Profesionales"
        description="Quiénes atienden, en qué sucursales, con qué horarios y qué servicios prestan."
        actions={
          <Link href="/panel/profesionales/nuevo" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            <Plus className="size-4" /> Nuevo profesional
          </Link>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {pros.map((p) => {
          const mine = assignments.filter((a) => a.pb.professionalId === p.id);
          const svc = serviceCounts.filter((s) => s.professionalId === p.id).length;
          return (
            <Link key={p.id} href={`/panel/profesionales/${p.id}`} className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-brand">
              <div className="flex items-center gap-3">
                <Avatar name={`${p.firstName} ${p.lastName}`} src={p.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-neutral-500">{svc} {svc === 1 ? "servicio" : "servicios"}</p>
                </div>
                {!p.isActive && <Badge>Inactivo</Badge>}
              </div>
              <div className="mt-3 space-y-2">
                {mine.map(({ pb, branch }) => (
                  <div key={pb.id} className="text-xs text-neutral-600">
                    <p className="font-medium text-ink">{branch.name || branch.address}</p>
                    <p>
                      {pb.schedule
                        .map((d, i) => (d.enabled && d.ranges.length ? `${WEEKDAYS_SHORT[i]} ${describeDay(d)}` : null))
                        .filter(Boolean)
                        .join(" · ") || "Sin horarios"}
                    </p>
                  </div>
                ))}
                {mine.length === 0 && <p className="text-xs text-amber-700">No tiene sucursal asignada: no aparece para reservar.</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
