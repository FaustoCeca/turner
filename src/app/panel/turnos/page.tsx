import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { APPOINTMENT_STATUS, appointments, bookings, branches, clients, professionals, type AppointmentStatus } from "@/db/schema";
import { expireHolds } from "@/lib/bookings";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";
import { addDays, formatInTz, isValidDateStr, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export const metadata: Metadata = { title: "Turnos" };

const LABELS: Record<AppointmentStatus, { label: string; tone: "green" | "yellow" | "red" | "blue" | "neutral" }> = {
  confirmed: { label: "Confirmado", tone: "blue" },
  pending_payment: { label: "Esperando seña", tone: "yellow" },
  completed: { label: "Realizado", tone: "green" },
  no_show: { label: "Ausente", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  expired: { label: "Vencido", tone: "neutral" },
};

type Props = { searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; profesional?: string }> };

export default async function AppointmentsListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { business } = await requireBusiness();
  await expireHolds(business.id);
  const db = await getDb();
  const tz = business.timezone;
  const today = todayIn(tz);
  const from = sp.desde && isValidDateStr(sp.desde) ? sp.desde : today;
  const to = sp.hasta && isValidDateStr(sp.hasta) ? sp.hasta : addDays(today, 30);
  const status = APPOINTMENT_STATUS.includes(sp.estado as AppointmentStatus) ? (sp.estado as AppointmentStatus) : null;

  const pros = await db.select().from(professionals).where(eq(professionals.businessId, business.id)).orderBy(asc(professionals.order));
  const rows = await db
    .select({ a: appointments, client: clients, pro: professionals, branch: branches, booking: bookings })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(
      and(
        eq(appointments.businessId, business.id),
        gte(appointments.startsAt, zonedToUtc(from, 0, tz)),
        lt(appointments.startsAt, zonedToUtc(addDays(to, 1), 0, tz)),
        status ? eq(appointments.status, status) : inArray(appointments.status, ["confirmed", "pending_payment", "completed", "no_show", "cancelled"]),
        sp.profesional ? eq(appointments.professionalId, sp.profesional) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(500);

  const money = (n: number) => formatMoney(n, business.currency);
  const billed = rows.filter((r) => ["confirmed", "completed"].includes(r.a.status)).reduce((s, r) => s + r.a.price - r.a.discount, 0);

  return (
    <>
      <PageHeader title="Turnos" description={`${rows.length} turnos · ${money(billed)} en turnos confirmados y realizados`} />
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <label>
          <span className="mb-1 block font-medium">Desde</span>
          <input type="date" name="desde" defaultValue={from} className="rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block font-medium">Hasta</span>
          <input type="date" name="hasta" defaultValue={to} className="rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block font-medium">Estado</span>
          <select name="estado" defaultValue={status ?? ""} className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="">Todos</option>
            {APPOINTMENT_STATUS.filter((s) => s !== "expired").map((s) => (
              <option key={s} value={s}>
                {LABELS[s].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block font-medium">Profesional</span>
          <select name="profesional" defaultValue={sp.profesional ?? ""} className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="">Todos</option>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Seña</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No hay turnos con estos filtros.
                </td>
              </tr>
            )}
            {rows.map(({ a, client, pro, branch, booking }) => (
              <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/panel?fecha=${utcToZoned(a.startsAt, tz).date}&sucursal=${branch.id}`} className="hover:underline">
                    {formatInTz(a.startsAt, tz, "EEE d/MM HH:mm")}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/panel/clientes/${client.id}`} className="hover:underline">
                    {client.firstName} {client.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.serviceName}</td>
                <td className="px-4 py-3">
                  {pro.firstName} {pro.lastName}
                  <span className="block text-xs text-neutral-500">{branch.name || branch.address}</span>
                </td>
                <td className="px-4 py-3">{money(a.price - a.discount)}</td>
                <td className="px-4 py-3">
                  {a.depositAmount
                    ? `${money(a.depositAmount)} ${booking?.paymentStatus === "approved" ? "✓" : booking?.paymentStatus === "refunded" ? "(devuelta)" : ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={LABELS[a.status].tone}>{LABELS[a.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
