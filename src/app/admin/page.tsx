import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { businesses, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { daysUntil } from "@/lib/panel";
import { formatInTz } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: { absolute: "Negocios | Administración" } };

export default async function AdminBusinessesPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      createdAt: businesses.createdAt,
      trialEndsAt: businesses.trialEndsAt,
      subscriptionStatus: businesses.subscriptionStatus,
      isOnline: businesses.isOnline,
      mpConnected: sql<boolean>`${businesses.mpAccessToken} is not null`,
      ownerId: users.id,
      ownerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      ownerEmail: users.email,
      ownerPhone: users.phone,
      professionals: sql<number>`(select count(*) from professionals p where p.business_id = ${businesses.id} and p.is_active)`.mapWith(Number),
      appointments30d: sql<number>`(select count(*) from appointments a where a.business_id = ${businesses.id} and a.created_at > now() - interval '30 days' and a.status <> 'expired')`.mapWith(Number),
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .orderBy(desc(businesses.createdAt));

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Negocios</h1>
      <p className="mb-5 text-sm text-neutral-600">
        {rows.length} {rows.length === 1 ? "negocio" : "negocios"} en la plataforma.
      </p>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Negocio</th>
              <th className="px-4 py-3">Dueño</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Prof.</th>
              <th className="px-4 py-3">Turnos 30 días</th>
              <th className="px-4 py-3">Mercado Pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const wa = whatsappLink(b.ownerPhone);
              const trialDays = daysUntil(b.trialEndsAt);
              return (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/${b.slug}`} target="_blank" className="font-medium hover:underline">
                      {b.name}
                    </Link>
                    <span className="block text-xs text-neutral-500">/{b.slug}{!b.isOnline && " · reservas pausadas"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/usuarios?q=${encodeURIComponent(b.ownerEmail)}`} className="hover:underline">
                      {b.ownerName}
                    </Link>
                    <span className="block text-xs text-neutral-500">
                      {b.ownerEmail}
                      {wa && (
                        <>
                          {" · "}
                          <a href={wa} target="_blank" rel="noreferrer" className="text-[#128c4a] underline">
                            WhatsApp
                          </a>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatInTz(b.createdAt, "America/Argentina/Buenos_Aires", "d/MM/yyyy")}</td>
                  <td className="px-4 py-3">
                    {b.subscriptionStatus === "active" ? (
                      <Badge tone="green">Activa</Badge>
                    ) : b.subscriptionStatus === "trial" ? (
                      <Badge tone={trialDays > 0 ? "yellow" : "red"}>{trialDays > 0 ? `Prueba: ${trialDays} días` : "Prueba vencida"}</Badge>
                    ) : (
                      <Badge>{b.subscriptionStatus}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{b.professionals}</td>
                  <td className="px-4 py-3 tabular-nums">{b.appointments30d}</td>
                  <td className="px-4 py-3">{b.mpConnected ? <Badge tone="green">Vinculado</Badge> : <span className="text-neutral-400">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
