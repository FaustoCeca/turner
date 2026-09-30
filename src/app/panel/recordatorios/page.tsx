import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { getDb } from "@/db";
import { appointments, branches, clients, professionals } from "@/db/schema";
import { expireHolds } from "@/lib/bookings";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/panel";
import { addDays, formatInTz, isValidDateStr, todayIn, zonedToUtc } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { RemindersList, type ReminderRow } from "./reminders-list";

export const metadata: Metadata = { title: "Recordatorios" };

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`)
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .replace(",", "");
}

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const { business } = await requireBusiness();
  await expireHolds(business.id);
  const tz = business.timezone;
  const today = todayIn(tz);
  const date = fecha && isValidDateStr(fecha) ? fecha : addDays(today, 1);
  const db = await getDb();

  const rows = await db
    .select({ a: appointments, client: clients, pro: professionals, branch: branches })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .where(
      and(
        eq(appointments.businessId, business.id),
        eq(appointments.status, "confirmed"),
        gte(appointments.startsAt, zonedToUtc(date, 0, tz)),
        lt(appointments.startsAt, zonedToUtc(addDays(date, 1), 0, tz)),
      ),
    )
    .orderBy(asc(appointments.startsAt));

  const dayLabel = date === today ? "hoy" : date === addDays(today, 1) ? "mañana" : `el ${longDate(date)}`;
  const reminders: ReminderRow[] = rows.map(({ a, client, pro, branch }) => {
    const time = formatInTz(a.startsAt, tz, "H:mm");
    const address = [branch.address, branch.city].filter(Boolean).join(", ");
    const text = [
      `¡Hola ${client.firstName}! Te recordamos tu turno de ${a.serviceName} ${dayLabel} a las ${time} hs con ${pro.firstName} en ${business.name} (${address}).`,
      client.userId
        ? `Si no podés venir, cancelalo o cambialo desde ${env.appUrl}/mis-turnos`
        : "Si no podés venir, avisanos por acá. ¡Te esperamos!",
    ].join("\n");
    return {
      id: a.id,
      time,
      client: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phone,
      service: a.serviceName,
      professional: `${pro.firstName} ${pro.lastName}`.trim(),
      whatsappUrl: whatsappLink(client.phone, text),
      sentAt: a.reminderSentAt ? formatInTz(a.reminderSentAt, tz, "d/MM HH:mm") : null,
    };
  });
  const pending = reminders.filter((r) => !r.sentAt && r.whatsappUrl).length;

  return (
    <>
      <PageHeader
        title="Recordatorios"
        description="Mandá el recordatorio por WhatsApp con un click: el mensaje ya está escrito."
        actions={
          <div className="flex gap-2 text-sm">
            <Link href={`?fecha=${addDays(date, -1)}`} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5">
              ← Día anterior
            </Link>
            <Link href={`?fecha=${addDays(date, 1)}`} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5">
              Día siguiente →
            </Link>
          </div>
        }
      />
      <p className="mb-4 font-medium first-letter:uppercase">
        {longDate(date)} · {reminders.length} {reminders.length === 1 ? "turno" : "turnos"}
        {pending > 0 && <span className="text-neutral-600"> · {pending} sin recordar</span>}
      </p>
      <RemindersList rows={reminders} />
    </>
  );
}
