import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/panel-ui";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { coupons } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";
import { formatInTz } from "@/lib/time";
import { deleteCouponAction, toggleCouponAction } from "../actions";
import { CouponForm } from "./coupon-form";

export const metadata: Metadata = { title: "Cupones" };

export default async function CouponsPage() {
  const { business } = await requireBusiness();
  const db = await getDb();
  const rows = await db.select().from(coupons).where(eq(coupons.businessId, business.id)).orderBy(desc(coupons.createdAt));
  const fmt = (d: Date | null) => (d ? formatInTz(d, business.timezone, "d/MM/yyyy") : null);

  return (
    <>
      <PageHeader title="Cupones de descuento" description="Tus clientes los ingresan en “Tengo código de descuento” al reservar." />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Descuento</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    No creaste cupones todavía.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-mono font-bold">
                    {c.code} {!c.isActive && <Badge>Pausado</Badge>}
                  </td>
                  <td className="px-4 py-3">{c.discountType === "percent" ? `${c.value}%` : formatMoney(c.value, business.currency)}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {c.validFrom || c.validUntil
                      ? `${fmt(c.validFrom) ?? "…"} → ${c.validUntil ? fmt(new Date(c.validUntil.getTime() - 1)) : "…"}`
                      : "Siempre"}
                  </td>
                  <td className="px-4 py-3">
                    {c.usesCount}
                    {c.maxUses != null && ` / ${c.maxUses}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                        <button className="underline">{c.isActive ? "Pausar" : "Activar"}</button>
                      </form>
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-red-600 underline">Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Section title="Nuevo cupón">
          <CouponForm />
        </Section>
      </div>
    </>
  );
}
