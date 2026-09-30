import { and, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/panel-ui";
import { getDb } from "@/db";
import { appointments, bookings, professionals } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";
import { todayIn, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Estadísticas" };

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${ym}-01`, to: `${next}-01`, label: `${MONTHS[m - 1]} ${y}` };
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { business } = await requireBusiness();
  const db = await getDb();
  const tz = business.timezone;
  const ym = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : todayIn(tz).slice(0, 7);
  const { from, to, label } = monthBounds(ym);
  const range = and(
    eq(appointments.businessId, business.id),
    gte(appointments.startsAt, zonedToUtc(from, 0, tz)),
    lt(appointments.startsAt, zonedToUtc(to, 0, tz)),
  );

  const rows = await db
    .select({ a: appointments, pro: professionals, booking: bookings })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(range);

  const valid = rows.filter((r) => r.a.status !== "expired");
  const done = valid.filter((r) => r.a.status === "completed");
  const noShow = valid.filter((r) => r.a.status === "no_show");
  const cancelled = valid.filter((r) => r.a.status === "cancelled");
  const scheduled = valid.filter((r) => ["confirmed", "completed", "no_show"].includes(r.a.status));
  const revenue = scheduled.filter((r) => r.a.status !== "no_show").reduce((s, r) => s + r.a.price - r.a.discount, 0);
  const online = valid.filter((r) => r.booking?.source === "online").length;
  const deposits = new Map<string, number>();
  for (const r of valid) {
    if (r.booking && r.booking.paymentStatus !== "none") deposits.set(r.booking.id, r.booking.paidAmount - r.booking.refundedAmount);
  }
  const depositTotal = [...deposits.values()].reduce((a, b) => a + b, 0);
  const noShowRate = done.length + noShow.length ? Math.round((noShow.length / (done.length + noShow.length)) * 100) : 0;

  const group = (key: (r: (typeof rows)[number]) => string) => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of scheduled) {
      const k = key(r);
      const v = map.get(k) ?? { count: 0, revenue: 0 };
      v.count++;
      if (r.a.status !== "no_show") v.revenue += r.a.price - r.a.discount;
      map.set(k, v);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  };
  const byService = group((r) => r.a.serviceName);
  const byPro = group((r) => `${r.pro.firstName} ${r.pro.lastName}`.trim());
  const money = (n: number) => formatMoney(n, business.currency);

  const [y, m] = ym.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title={`Estadísticas · ${label}`}
        actions={
          <div className="flex gap-2 text-sm">
            <a href={`?mes=${prev}`} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5">← Anterior</a>
            <a href={`?mes=${next}`} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5">Siguiente →</a>
          </div>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Turnos agendados" value={String(scheduled.length)} hint={`${online} reservados online`} />
        <Stat label="Facturación estimada" value={money(revenue)} hint="Confirmados + realizados" />
        <Stat label="Señas cobradas" value={money(depositTotal)} hint="Neto de devoluciones" />
        <Stat label="Ausentismo" value={`${noShowRate}%`} hint={`${noShow.length} ausentes · ${cancelled.length} cancelados`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Por servicio">
          <Ranking rows={byService} money={money} />
        </Section>
        <Section title="Por profesional">
          <Ranking rows={byPro} money={money} />
        </Section>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function Ranking({ rows, money }: { rows: [string, { count: number; revenue: number }][]; money: (n: number) => string }) {
  if (!rows.length) return <p className="text-sm text-neutral-600">Sin turnos en este período.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-neutral-500">
        <tr>
          <th className="pb-2">Nombre</th>
          <th className="pb-2 text-right">Turnos</th>
          <th className="pb-2 text-right">Facturación</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, v]) => (
          <tr key={name} className="border-t border-neutral-100">
            <td className="py-2">{name}</td>
            <td className="py-2 text-right tabular-nums">{v.count}</td>
            <td className="py-2 text-right tabular-nums">{money(v.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
