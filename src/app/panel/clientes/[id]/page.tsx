import { and, desc, eq } from "drizzle-orm";
import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/panel-ui";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { appointments, clients, professionals } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { formatMoney } from "@/lib/pricing";
import { formatInTz } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Cliente" };

const STATUS: Record<string, string> = {
  confirmed: "Confirmado",
  pending_payment: "Esperando seña",
  completed: "Realizado",
  no_show: "Ausente",
  cancelled: "Cancelado",
  expired: "Vencido",
};

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const db = await getDb();
  const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.businessId, business.id)));
  if (!client) notFound();
  const history = await db
    .select({ a: appointments, pro: professionals })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(eq(appointments.clientId, client.id))
    .orderBy(desc(appointments.startsAt))
    .limit(100);

  const completed = history.filter((h) => h.a.status === "completed");
  const spent = completed.reduce((s, h) => s + h.a.price - h.a.discount, 0);
  const noShows = history.filter((h) => h.a.status === "no_show").length;

  return (
    <>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`.trim()}
        description={client.userId ? "Tiene cuenta y reserva online" : "Cargado desde el panel"}
        actions={
          <>
            {whatsappLink(client.phone) && (
              <a
                href={whatsappLink(client.phone)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-4 py-2 text-sm font-medium text-white"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            )}
            <Link href="/panel/clientes" className="self-center text-sm underline">
              Volver
            </Link>
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Visitas realizadas" value={String(completed.length)} />
        <Stat label="Total gastado" value={formatMoney(spent, business.currency)} />
        <Stat label="Ausencias" value={String(noShows)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Datos">
          <ClientForm client={client} />
        </Section>
        <Section title="Historial de turnos">
          {history.length === 0 ? (
            <p className="text-sm text-neutral-600">Sin turnos.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {history.map(({ a, pro }) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{a.serviceName}</p>
                    <p className="text-neutral-500">
                      {formatInTz(a.startsAt, business.timezone, "d/MM/yyyy HH:mm")} · {pro.firstName}
                    </p>
                  </div>
                  <Badge>{STATUS[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
