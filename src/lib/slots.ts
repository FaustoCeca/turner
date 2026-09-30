import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  appointments,
  bookings,
  branches,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  timeBlocks,
  type Business,
  type Service,
} from "@/db/schema";
import { computeDay, computeRange, isWithinWindow, type BusyInterval, type DayAvailability } from "./availability";
import type { WeekSchedule } from "./schedule";
import { addDays, todayIn, zonedToUtc } from "./time";

/** Estados de turno que ocupan la agenda. Los pendientes de pago sólo mientras dure la reserva temporal. */
const OCCUPYING = ["confirmed", "completed", "no_show", "pending_payment"] as const;

export type SlotContext = {
  service: Service;
  professionalId: string;
  branchId: string;
  schedule: WeekSchedule;
  serviceWeekdays: number[];
};

type BusinessConfig = Pick<
  Business,
  "id" | "timezone" | "slotMinutes" | "minAnticipationMinutes" | "maxDaysInFuture"
>;

/** Valida que el profesional preste el servicio en esa sucursal y devuelve su horario. */
export async function getSlotContext(
  db: DbOrTx,
  businessId: string,
  ids: { serviceId: string; professionalId: string; branchId: string },
  opts: { onlineOnly?: boolean } = {},
): Promise<SlotContext | null> {
  const [row] = await db
    .select({
      service: services,
      schedule: professionalBranches.schedule,
      weekdays: professionalServices.weekdays,
    })
    .from(services)
    .innerJoin(
      professionalServices,
      and(
        eq(professionalServices.serviceId, services.id),
        eq(professionalServices.professionalId, ids.professionalId),
      ),
    )
    .innerJoin(professionals, eq(professionals.id, professionalServices.professionalId))
    .innerJoin(
      professionalBranches,
      and(
        eq(professionalBranches.professionalId, professionals.id),
        eq(professionalBranches.branchId, ids.branchId),
      ),
    )
    .innerJoin(branches, eq(branches.id, professionalBranches.branchId))
    .where(
      and(
        eq(services.id, ids.serviceId),
        eq(services.businessId, businessId),
        eq(services.isActive, true),
        opts.onlineOnly ? eq(services.isOnline, true) : undefined,
        eq(professionals.businessId, businessId),
        eq(professionals.isActive, true),
        eq(branches.businessId, businessId),
        eq(branches.isActive, true),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    service: row.service,
    professionalId: ids.professionalId,
    branchId: ids.branchId,
    schedule: row.schedule,
    serviceWeekdays: row.weekdays,
  };
}

/** Intervalos ocupados del profesional (en cualquier sucursal) + bloqueos de agenda. */
export async function loadBusy(
  db: DbOrTx,
  params: {
    businessId: string;
    professionalId: string;
    branchId: string;
    from: Date;
    to: Date;
    now: Date;
    excludeAppointmentIds?: string[];
  },
): Promise<BusyInterval[]> {
  const exclude = params.excludeAppointmentIds ?? [];
  const appts = await db
    .select({
      id: appointments.id,
      start: appointments.startsAt,
      end: appointments.blockEndsAt,
      status: appointments.status,
      holdExpiresAt: bookings.holdExpiresAt,
    })
    .from(appointments)
    .leftJoin(bookings, eq(bookings.id, appointments.bookingId))
    .where(
      and(
        eq(appointments.professionalId, params.professionalId),
        inArray(appointments.status, [...OCCUPYING]),
        lt(appointments.startsAt, params.to),
        gt(appointments.blockEndsAt, params.from),
      ),
    );

  const blocks = await db
    .select({ start: timeBlocks.startsAt, end: timeBlocks.endsAt })
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.businessId, params.businessId),
        or(eq(timeBlocks.professionalId, params.professionalId), isNull(timeBlocks.professionalId)),
        or(eq(timeBlocks.branchId, params.branchId), isNull(timeBlocks.branchId)),
        lt(timeBlocks.startsAt, params.to),
        gt(timeBlocks.endsAt, params.from),
      ),
    );

  const now = params.now.getTime();
  return [
    ...appts
      .filter((a) => !exclude.includes(a.id))
      .filter((a) => a.status !== "pending_payment" || (a.holdExpiresAt?.getTime() ?? 0) > now)
      .map((a) => ({ start: a.start.getTime(), end: a.end.getTime() })),
    ...blocks.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() })),
  ];
}

/** Disponibilidad de los próximos días para la reserva online. */
export async function getAvailability(
  db: DbOrTx,
  business: BusinessConfig,
  ctx: SlotContext,
  opts: { now?: Date; excludeAppointmentIds?: string[] } = {},
): Promise<DayAvailability[]> {
  const now = opts.now ?? new Date();
  const today = todayIn(business.timezone, now);
  const busy = await loadBusy(db, {
    businessId: business.id,
    professionalId: ctx.professionalId,
    branchId: ctx.branchId,
    from: zonedToUtc(today, 0, business.timezone),
    to: zonedToUtc(addDays(today, business.maxDaysInFuture + 1), 0, business.timezone),
    now,
    excludeAppointmentIds: opts.excludeAppointmentIds,
  });
  return computeRange({
    timeZone: business.timezone,
    schedule: ctx.schedule,
    serviceWeekdays: ctx.serviceWeekdays,
    blockingMinutes: ctx.service.blockingMinutes,
    slotMinutes: business.slotMinutes,
    busy,
    now,
    today,
    minAnticipationMinutes: business.minAnticipationMinutes,
    maxDaysInFuture: business.maxDaysInFuture,
  });
}

/**
 * Verifica que (fecha, minutos) sea un horario reservable ahora mismo.
 * `extraBusy` permite sumar los otros turnos del mismo carrito.
 */
export async function isSlotBookable(
  db: DbOrTx,
  business: BusinessConfig,
  ctx: SlotContext,
  date: string,
  minutes: number,
  opts: { now?: Date; extraBusy?: BusyInterval[]; excludeAppointmentIds?: string[] } = {},
): Promise<boolean> {
  const now = opts.now ?? new Date();
  const today = todayIn(business.timezone, now);
  if (!isWithinWindow(date, today, business.maxDaysInFuture)) return false;
  const busy = await loadBusy(db, {
    businessId: business.id,
    professionalId: ctx.professionalId,
    branchId: ctx.branchId,
    from: zonedToUtc(date, 0, business.timezone),
    to: zonedToUtc(addDays(date, 1), 0, business.timezone),
    now,
    excludeAppointmentIds: opts.excludeAppointmentIds,
  });
  const day = computeDay({
    date,
    timeZone: business.timezone,
    schedule: ctx.schedule,
    serviceWeekdays: ctx.serviceWeekdays,
    blockingMinutes: ctx.service.blockingMinutes,
    slotMinutes: business.slotMinutes,
    busy: [...busy, ...(opts.extraBusy ?? [])],
    earliestStart: now.getTime() + business.minAnticipationMinutes * 60_000,
  });
  return day.slots.includes(minutes);
}

/** Profesionales que prestan un servicio, agrupados por sucursal (paso 2 de la reserva). */
export async function getProfessionalsForService(db: DbOrTx, businessId: string, serviceId: string) {
  const rows = await db
    .select({
      professional: {
        id: professionals.id,
        firstName: professionals.firstName,
        lastName: professionals.lastName,
        avatarUrl: professionals.avatarUrl,
      },
      branch: {
        id: branches.id,
        name: branches.name,
        address: branches.address,
        city: branches.city,
        lat: branches.lat,
        lng: branches.lng,
        order: branches.order,
      },
    })
    .from(professionalServices)
    .innerJoin(professionals, eq(professionals.id, professionalServices.professionalId))
    .innerJoin(professionalBranches, eq(professionalBranches.professionalId, professionals.id))
    .innerJoin(branches, eq(branches.id, professionalBranches.branchId))
    .where(
      and(
        eq(professionalServices.serviceId, serviceId),
        eq(professionals.businessId, businessId),
        eq(professionals.isActive, true),
        eq(branches.isActive, true),
      ),
    )
    .orderBy(asc(branches.order), asc(branches.createdAt), asc(professionals.order), asc(professionals.createdAt));

  const groups = new Map<string, { branch: (typeof rows)[number]["branch"]; professionals: (typeof rows)[number]["professional"][] }>();
  for (const r of rows) {
    const g = groups.get(r.branch.id) ?? { branch: r.branch, professionals: [] };
    g.professionals.push(r.professional);
    groups.set(r.branch.id, g);
  }
  return [...groups.values()];
}

