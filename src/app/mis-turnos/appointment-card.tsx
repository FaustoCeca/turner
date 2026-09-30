"use client";

import { CalendarClock, CalendarPlus, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelMyAppointmentAction, rescheduleMyAppointmentAction, type ActionResult } from "@/app/actions/client";
import { DateSlotPicker } from "@/components/booking/date-picker";
import type { DayAvailability } from "@/components/booking/types";
import { Alert, Badge, Button, Modal } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";

export type MyAppointment = {
  id: string;
  bookingId: string | null;
  slug: string;
  businessName: string;
  primaryColor: string;
  serviceName: string;
  professional: string;
  address: string;
  when: string;
  price: string | null;
  deposit: string | null;
  depositPaid: boolean;
  status: string;
  upcoming: boolean;
  canModify: boolean;
  canReschedule: boolean;
  refundOnCancel: boolean;
  checkoutUrl: string | null;
  whatsapp: string | null;
  googleCalendarUrl: string;
};

const STATUS: Record<string, { label: string; tone: "green" | "yellow" | "red" | "neutral" | "blue" }> = {
  confirmed: { label: "Confirmado", tone: "green" },
  pending_payment: { label: "Falta pagar la seña", tone: "yellow" },
  completed: { label: "Realizado", tone: "blue" },
  no_show: { label: "Ausente", tone: "red" },
  cancelled: { label: "Cancelado", tone: "red" },
  expired: { label: "Vencido", tone: "neutral" },
};

export function MyAppointmentCard({ appointment: a }: { appointment: MyAppointment }) {
  const [dialog, setDialog] = useState<"cancel" | "reschedule" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const status = STATUS[a.status] ?? STATUS.expired;

  async function openReschedule() {
    setDialog("reschedule");
    setResult(null);
    setDays(null);
    setDate(null);
    setMinutes(null);
    const res = await fetch(`/api/appointments/${a.id}/availability`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) setResult({ error: data.error });
    else setDays(data.days);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4" style={{ borderLeft: `4px solid ${a.primaryColor}` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/${a.slug}`} className="text-sm font-medium text-neutral-500 hover:underline">
            {a.businessName}
          </Link>
          <p className="text-lg font-bold">{a.serviceName}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-2 space-y-1 text-sm text-neutral-700">
        <p className="flex items-center gap-2 first-letter:uppercase">
          <CalendarClock className="size-4 shrink-0" /> <span className="first-letter:uppercase">{a.when}</span>
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="size-4 shrink-0" /> {a.professional}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" /> {a.address}
        </p>
        {(a.price || a.deposit) && (
          <p className="text-neutral-600">
            {a.price}
            {a.deposit && ` · Seña ${a.deposit}${a.depositPaid ? " (abonada)" : ""}`}
          </p>
        )}
      </div>

      {result?.message && <div className="mt-3"><Alert tone="green">{result.message}</Alert></div>}

      {a.upcoming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {a.checkoutUrl && (
            <a href={a.checkoutUrl} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white" style={{ background: a.primaryColor }}>
              Abonar seña
            </a>
          )}
          {a.canReschedule && (
            <Button variant="secondary" onClick={openReschedule}>
              Modificar
            </Button>
          )}
          {a.canModify && (
            <Button variant="secondary" className="text-red-600" onClick={() => { setDialog("cancel"); setResult(null); }}>
              Cancelar
            </Button>
          )}
          {a.status === "confirmed" && (
            <>
              <a href={a.googleCalendarUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                <CalendarPlus className="size-4" /> Google Calendar
              </a>
              <a href={`/api/turnos/${a.id}/calendario`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                <CalendarPlus className="size-4" /> iPhone / Outlook
              </a>
            </>
          )}
          {!a.canModify && whatsappLink(a.whatsapp) && (
            <a href={whatsappLink(a.whatsapp)!} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
              Contactar al negocio
            </a>
          )}
        </div>
      )}

      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancelar turno">
        <p>
          ¿Seguro que querés cancelar <b>{a.serviceName}</b> del {a.when}?
        </p>
        {a.deposit && a.depositPaid && (
          <p className="mt-2 text-sm text-neutral-600">
            {a.refundOnCancel
              ? `Te devolvemos la seña (${a.deposit}) al medio de pago original.`
              : "Por la política del negocio, la seña no es reembolsable a esta altura."}
          </p>
        )}
        {result?.error && <div className="mt-3"><Alert>{result.error}</Alert></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Volver
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await cancelMyAppointmentAction(a.id);
                setResult(r);
                if (r.ok) setDialog(null);
              })
            }
          >
            Cancelar turno
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === "reschedule"} onClose={() => setDialog(null)} title="Modificar turno" size="lg">
        <div style={{ ["--brand" as string]: a.primaryColor }}>
          <p className="mb-4 text-sm text-neutral-600">
            Elegí un nuevo día y horario para <b>{a.serviceName}</b> con {a.professional}.
          </p>
          {!days && !result?.error && <p className="py-6 text-center text-sm text-neutral-500">Cargando horarios…</p>}
          {days && (
            <DateSlotPicker
              days={days}
              selectedDate={date}
              selectedMinutes={minutes}
              onSelectDate={(d) => {
                setDate(d);
                setMinutes(null);
              }}
              onSelectSlot={setMinutes}
            />
          )}
          {result?.error && <div className="mt-3"><Alert>{result.error}</Alert></div>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Volver
            </Button>
            <Button
              disabled={!date || minutes == null}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await rescheduleMyAppointmentAction(a.id, date!, minutes!);
                  setResult(r);
                  if (r.ok) setDialog(null);
                })
              }
            >
              Confirmar cambio
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
