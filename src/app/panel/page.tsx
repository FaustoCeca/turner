import { and, asc, eq, gt, isNull, lt, notInArray, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import {
  appointments,
  bookings,
  branches,
  clients,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  timeBlocks,
} from "@/db/schema";
import { expireHolds } from "@/lib/bookings";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";
import { addDays, isValidDateStr, todayIn, utcToZoned, weekdayOf, zonedToUtc } from "@/lib/time";
import { AgendaView, type AgendaAppointment, type AgendaColumn } from "./agenda-view";

export const metadata: Metadata = { title: { absolute: "Agenda | Panel" } };

type Props = { searchParams: Promise<{ fecha?: string; sucursal?: string; bienvenida?: string }> };

export default async function AgendaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { business } = await requireBusiness();
  await expireHolds(business.id);
  const db = await getDb();
  const tz = business.timezone;
  const today = todayIn(tz);
  const date = sp.fecha && isValidDateStr(sp.fecha) ? sp.fecha : today;
  const dayStart = zonedToUtc(date, 0, tz);
  const dayEnd = zonedToUtc(addDays(date, 1), 0, tz);

  const branchRows = await db
    .select()
    .from(branches)
    .where(and(eq(branches.businessId, business.id), eq(branches.isActive, true)))
    .orderBy(asc(branches.order), asc(branches.createdAt));
  const branchId = branchRows.some((b) => b.id === sp.sucursal) ? sp.sucursal! : (branchRows[0]?.id ?? "");

  const [assignments, serviceRows, proServices, apptRows, blockRows] = await Promise.all([
    db
      .select({ pb: professionalBranches, pro: professionals })
      .from(professionalBranches)
      .innerJoin(professionals, eq(professionals.id, professionalBranches.professionalId))
      .where(and(eq(professionals.businessId, business.id), eq(professionals.isActive, true)))
      .orderBy(asc(professionals.order), asc(professionals.createdAt)),
    db
      .select()
      .from(services)
      .where(and(eq(services.businessId, business.id), eq(services.isActive, true)))
      .orderBy(asc(services.order)),
    db
      .select({ professionalId: professionalServices.professionalId, serviceId: professionalServices.serviceId })
      .from(professionalServices)
      .innerJoin(services, eq(services.id, professionalServices.serviceId))
      .where(eq(services.businessId, business.id)),
    db
      .select({ a: appointments, client: clients, booking: bookings })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
      .where(
        and(
          eq(appointments.businessId, business.id),
          lt(appointments.startsAt, dayEnd),
          gt(appointments.blockEndsAt, dayStart),
          notInArray(appointments.status, ["expired"]),
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    db
      .select()
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.businessId, business.id),
          lt(timeBlocks.startsAt, dayEnd),
          gt(timeBlocks.endsAt, dayStart),
          branchId ? or(isNull(timeBlocks.branchId), eq(timeBlocks.branchId, branchId)) : undefined,
        ),
      ),
  ]);

  const weekday = weekdayOf(date);
  const inBranch = assignments.filter((x) => x.pb.branchId === branchId);
  const columns: AgendaColumn[] = inBranch.map(({ pb, pro }) => ({
    id: pro.id,
    name: `${pro.firstName} ${pro.lastName}`.trim(),
    avatarUrl: pro.avatarUrl,
    ranges: pb.schedule[weekday]?.enabled ? pb.schedule[weekday].ranges : [],
  }));

  const toMinutes = (d: Date) => {
    if (d <= dayStart) return 0;
    if (d >= dayEnd) return 1440;
    return utcToZoned(d, tz).minutes;
  };

  const visibleIds = new Set(columns.map((c) => c.id));
  const agendaAppointments: AgendaAppointment[] = apptRows
    // Turnos de esta sucursal + los de sus profesionales en otras sucursales (se muestran como "ocupado").
    .filter(({ a }) => a.branchId === branchId || visibleIds.has(a.professionalId))
    .map(({ a, client, booking }) => ({
      id: a.id,
      professionalId: a.professionalId,
      branchId: a.branchId,
      start: toMinutes(a.startsAt),
      end: toMinutes(a.endsAt),
      blockEnd: toMinutes(a.blockEndsAt),
      date,
      status: a.status,
      serviceName: a.serviceName,
      serviceId: a.serviceId,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      clientPhone: client.phone,
      clientEmail: client.email,
      price: formatMoney(a.price - a.discount, business.currency),
      deposit: a.depositAmount ? formatMoney(a.depositAmount, business.currency) : null,
      depositPaid: booking?.paymentStatus === "approved",
      depositRefunded: booking?.paymentStatus === "refunded",
      notes: a.notes,
      source: booking?.source ?? "panel",
      cancelReason: a.cancelReason,
    }));

  const blocks = blockRows.map((b) => ({
    id: b.id,
    professionalId: b.professionalId,
    start: toMinutes(b.startsAt),
    end: toMinutes(b.endsAt),
    reason: b.reason,
  }));

  const proIds = [...new Set(assignments.map((x) => x.pro.id))];
  const showWelcome = sp.bienvenida === "1" || serviceRows.length === 0;

  return (
    <>
      {showWelcome && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-white p-5">
          <h2 className="text-lg font-bold">Primeros pasos</h2>
          <ol className="mt-3 space-y-2 text-sm">
            <li>✅ Creaste tu negocio</li>
            <li>{serviceRows.length ? "✅" : "⬜"} <Link className="underline" href="/panel/servicios/nuevo">Cargá tus servicios</Link> con precio y duración</li>
            <li>⬜ <Link className="underline" href="/panel/profesionales">Revisá los horarios</Link> de cada profesional</li>
            <li>⬜ <Link className="underline" href="/panel/configuracion#senas">Configurá las señas</Link> y vinculá Mercado Pago</li>
            <li>
              ⬜ Compartí tu link:{" "}
              <Link className="font-medium text-brand underline" href={`/${business.slug}`} target="_blank">
                /{business.slug}
              </Link>
            </li>
          </ol>
        </div>
      )}
      <AgendaView
        date={date}
        today={today}
        branches={branchRows.map((b) => ({ id: b.id, name: b.name || b.address }))}
        branchId={branchId}
        columns={columns}
        appointments={agendaAppointments}
        blocks={blocks}
        whatsappBusinessName={business.name}
        formData={{
          services: serviceRows.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.durationMinutes })),
          professionals: proIds.map((id) => {
            const pro = assignments.find((x) => x.pro.id === id)!.pro;
            return {
              id,
              name: `${pro.firstName} ${pro.lastName}`.trim(),
              branchIds: assignments.filter((x) => x.pro.id === id).map((x) => x.pb.branchId),
              serviceIds: proServices.filter((ps) => ps.professionalId === id).map((ps) => ps.serviceId),
            };
          }),
        }}
      />
    </>
  );
}
