import { desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { businessMembers, businesses, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { formatInTz } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { ResetAccessButton } from "./reset-access-button";

export const metadata: Metadata = { title: "Usuarios" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const db = await getDb();
  const term = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      createdAt: users.createdAt,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(users)
    .where(
      term
        ? or(ilike(users.email, term), ilike(users.phone, term), ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, term))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(50);
  const memberships = rows.length
    ? await db
        .select({ userId: businessMembers.userId, name: businesses.name, slug: businesses.slug })
        .from(businessMembers)
        .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
        .where(inArray(businessMembers.userId, rows.map((r) => r.id)))
    : [];

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Usuarios</h1>
      <p className="mb-5 text-sm text-neutral-600">
        Para rescatar una cuenta: generá un código de recuperación y enviáselo al usuario por WhatsApp. Con ese código crea su contraseña nueva en
        /recuperar.
      </p>
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por email, nombre o teléfono"
          className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
      </form>
      <ul className="space-y-2">
        {rows.length === 0 && <li className="rounded-xl bg-white p-6 text-center text-sm text-neutral-500">Sin resultados.</li>}
        {rows.map((u) => {
          const wa = whatsappLink(u.phone);
          const owned = memberships.filter((m) => m.userId === u.id);
          return (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="min-w-0 text-sm">
                <p className="font-bold">
                  {u.firstName} {u.lastName} {u.isPlatformAdmin && <span className="text-xs font-normal text-neutral-500">(administrador)</span>}
                </p>
                <p className="text-neutral-600">
                  {u.email}
                  {u.phone && ` · ${u.phone}`}
                  {wa && (
                    <>
                      {" · "}
                      <a href={wa} target="_blank" rel="noreferrer" className="text-[#128c4a] underline">
                        WhatsApp
                      </a>
                    </>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  Alta {formatInTz(u.createdAt, "America/Argentina/Buenos_Aires", "d/MM/yyyy")}
                  {owned.length > 0 && ` · Negocios: ${owned.map((m) => m.name).join(", ")}`}
                </p>
              </div>
              <ResetAccessButton userId={u.id} email={u.email} phone={u.phone} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
