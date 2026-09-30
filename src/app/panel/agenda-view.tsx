"use client";

import { Ban, ChevronLeft, ChevronRight, MessageCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { FormMessage } from "@/components/panel-ui";
import { Alert, Avatar, Badge, Button, Checkbox, cn, Field, Input, Modal, Select, SubmitButton, Textarea, ActionForm } from "@/components/ui";
import type { AppointmentStatus } from "@/db/schema";
import { minutesToHHMM, type TimeRange } from "@/lib/schedule";
import { whatsappLink } from "@/lib/whatsapp";
import {
  cancelAppointmentByBusinessAction,
  createManualAppointmentAction,
  rescheduleByBusinessAction,
  searchClientsAction,
  setAppointmentStatusAction,
  type ActionState,
} from "./actions";
import { BlockForm } from "./block-form";

export type AgendaColumn = { id: string; name: string; avatarUrl: string | null; ranges: TimeRange[] };

export type AgendaAppointment = {
  id: string;
  professionalId: string;
  branchId: string;
  start: number;
  end: number;
  blockEnd: number;
  date: string;
  status: AppointmentStatus;
  serviceName: string;
  serviceId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  price: string;
  deposit: string | null;
  depositPaid: boolean;
  depositRefunded: boolean;
  notes: string | null;
  source: string;
  cancelReason: string | null;
};

type Block = { id: string; professionalId: string | null; start: number; end: number; reason: string | null };

type FormData_ = {
  services: { id: string; name: string; price: number; duration: number }[];
  professionals: { id: string; name: string; branchIds: string[]; serviceIds: string[] }[];
};

const ROW = 18; // px por bloque de 15 minutos

const STATUS: Record<string, { label: string; box: string; tone: "green" | "yellow" | "red" | "blue" | "neutral" }> = {
  confirmed: { label: "Confirmado", box: "border-brand bg-[color-mix(in_srgb,var(--brand)_14%,white)]", tone: "blue" },
  pending_payment: { label: "Esperando seña", box: "border-amber-500 bg-amber-50", tone: "yellow" },
  completed: { label: "Realizado", box: "border-emerald-500 bg-emerald-50", tone: "green" },
  no_show: { label: "Ausente", box: "border-red-500 bg-red-50", tone: "red" },
  cancelled: { label: "Cancelado", box: "border-neutral-400 bg-neutral-100", tone: "neutral" },
};

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function AgendaView({
  date,
  today,
  branches,
  branchId,
  columns,
  appointments,
  blocks,
  formData,
  whatsappBusinessName,
}: {
  date: string;
  today: string;
  branches: { id: string; name: string }[];
  branchId: string;
  columns: AgendaColumn[];
  appointments: AgendaAppointment[];
  blocks: Block[];
  formData: FormData_;
  whatsappBusinessName: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [modal, setModal] = useState<"new" | "block" | null>(null);
  const [newDefaults, setNewDefaults] = useState<{ professionalId?: string; time?: string }>({});

  const go = (params: { fecha?: string; sucursal?: string }) => {
    const q = new URLSearchParams({ fecha: params.fecha ?? date, sucursal: params.sucursal ?? branchId });
    router.push(`/panel?${q}`);
  };

  const active = appointments.filter((a) => a.status !== "cancelled");
  const cancelled = appointments.filter((a) => a.status === "cancelled" && a.branchId === branchId);

  const [gridStart, gridEnd] = useMemo(() => {
    const starts = [8 * 60, ...columns.flatMap((c) => c.ranges.map((r) => r.start)), ...active.map((a) => a.start)];
    const ends = [20 * 60, ...columns.flatMap((c) => c.ranges.map((r) => r.end)), ...active.map((a) => a.blockEnd)];
    return [Math.floor(Math.min(...starts) / 60) * 60, Math.ceil(Math.max(...ends) / 60) * 60];
  }, [columns, active]);
  const height = ((gridEnd - gridStart) / 15) * ROW;
  const top = (m: number) => ((Math.max(m, gridStart) - gridStart) / 15) * ROW;

  const hours: number[] = [];
  for (let m = gridStart; m < gridEnd; m += 60) hours.push(m);

  const counts = {
    total: active.filter((a) => a.branchId === branchId).length,
    pending: active.filter((a) => a.branchId === branchId && a.status === "pending_payment").length,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="px-2.5" onClick={() => go({ fecha: addDays(date, -1) })} aria-label="Día anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" onClick={() => go({ fecha: today })} disabled={date === today}>
            Hoy
          </Button>
          <Button variant="secondary" className="px-2.5" onClick={() => go({ fecha: addDays(date, 1) })} aria-label="Día siguiente">
            <ChevronRight className="size-4" />
          </Button>
          <h1 className="ml-1 text-xl font-bold first-letter:uppercase">{longDate(date)}</h1>
          <Input type="date" value={date} onChange={(e) => e.target.value && go({ fecha: e.target.value })} className="w-auto py-1.5" aria-label="Elegir fecha" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <Select value={branchId} onChange={(e) => go({ sucursal: e.target.value })} className="w-auto" aria-label="Sucursal">
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          <Button variant="secondary" onClick={() => setModal("block")}>
            <Ban className="size-4" /> Bloquear horario
          </Button>
          <Button
            onClick={() => {
              setNewDefaults({});
              setModal("new");
            }}
          >
            <Plus className="size-4" /> Nuevo turno
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-neutral-600">
        {counts.total} {counts.total === 1 ? "turno" : "turnos"}
        {counts.pending > 0 && ` · ${counts.pending} esperando seña`}
      </p>

      {columns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-600">
          No hay profesionales asignados a esta sucursal. Asignalos desde Profesionales.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <div style={{ minWidth: 64 + columns.length * 170 }}>
            <div className="sticky top-0 z-10 flex border-b border-neutral-200 bg-white">
              <div className="w-16 shrink-0" />
              {columns.map((c) => (
                <div key={c.id} className="flex flex-1 items-center gap-2 border-l border-neutral-100 px-3 py-2 text-sm font-medium">
                  <Avatar name={c.name} src={c.avatarUrl} size={24} />
                  <span className="truncate">{c.name}</span>
                </div>
              ))}
            </div>
            <div className="relative flex pt-2" style={{ height: height + 8 }}>
              <div className="w-16 shrink-0">
                {hours.map((h) => (
                  <div key={h} className="relative text-right text-xs text-neutral-500" style={{ height: 4 * ROW }}>
                    <span className="absolute -top-2 right-2">{minutesToHHMM(h)}</span>
                  </div>
                ))}
              </div>
              {columns.map((c) => (
                <div key={c.id} className="relative flex-1 border-l border-neutral-100 bg-neutral-100/70">
                  {c.ranges.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Agendar con ${c.name}`}
                      className="absolute inset-x-0 bg-white"
                      style={{ top: top(r.start), height: top(r.end) - top(r.start) }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offset = Math.floor((e.clientY - rect.top) / ROW) * 15;
                        setNewDefaults({ professionalId: c.id, time: minutesToHHMM(r.start + offset) });
                        setModal("new");
                      }}
                    />
                  ))}
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-neutral-200" style={{ top: top(h) }}>
                      <div className="border-t border-dashed border-neutral-100" style={{ marginTop: 2 * ROW }} />
                    </div>
                  ))}
                  {blocks
                    .filter((b) => b.professionalId === null || b.professionalId === c.id)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="pointer-events-none absolute inset-x-1 overflow-hidden rounded bg-[repeating-linear-gradient(45deg,#e5e5e5,#e5e5e5_6px,#f5f5f5_6px,#f5f5f5_12px)] px-2 py-1 text-xs text-neutral-600"
                        style={{ top: top(b.start), height: Math.max(ROW, top(b.end) - top(b.start)) }}
                      >
                        Bloqueado{b.reason && `: ${b.reason}`}
                      </div>
                    ))}
                  {active
                    .filter((a) => a.professionalId === c.id)
                    .map((a) => {
                      const elsewhere = a.branchId !== branchId;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          disabled={elsewhere}
                          onClick={() => setSelected(a)}
                          className={cn(
                            "absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm transition hover:z-10 hover:shadow-md",
                            elsewhere ? "border-neutral-400 bg-neutral-200 text-neutral-600" : STATUS[a.status].box,
                          )}
                          style={{ top: top(a.start), height: Math.max(ROW, top(a.blockEnd) - top(a.start)) - 2 }}
                        >
                          {elsewhere ? (
                            <p>Ocupado en otra sucursal</p>
                          ) : (
                            <>
                              <p className="font-bold">
                                {minutesToHHMM(a.start)} {a.clientName}
                              </p>
                              <p className="truncate">{a.serviceName}</p>
                            </>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cancelled.length > 0 && (
        <details className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium">{cancelled.length} cancelados este día</summary>
          <ul className="mt-2 space-y-1 text-neutral-600">
            {cancelled.map((a) => (
              <li key={a.id}>
                {minutesToHHMM(a.start)} · {a.clientName} · {a.serviceName}
                {a.cancelReason && ` — ${a.cancelReason}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Detalle del turno">
        {selected && (
          <AppointmentDetail
            key={selected.id}
            appointment={selected}
            professionals={formData.professionals.filter((p) => p.branchIds.includes(branchId) && p.serviceIds.includes(selected.serviceId))}
            businessName={whatsappBusinessName}
            onDone={() => setSelected(null)}
          />
        )}
      </Modal>

      <Modal open={modal === "new"} onClose={() => setModal(null)} title="Nuevo turno" size="lg">
        {modal === "new" && (
          <NewAppointmentForm
            date={date}
            branchId={branchId}
            defaults={newDefaults}
            data={formData}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal === "block"} onClose={() => setModal(null)} title="Bloquear horario" size="lg">
        {modal === "block" && (
          <BlockForm
            professionals={columns.map((c) => ({ id: c.id, name: c.name }))}
            branches={branches}
            defaultDate={date}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function AppointmentDetail({
  appointment: a,
  professionals,
  businessName,
  onDone,
}: {
  appointment: AgendaAppointment;
  professionals: { id: string; name: string }[];
  businessName: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const [mode, setMode] = useState<"view" | "cancel" | "reschedule">("view");
  const [refund, setRefund] = useState(true);
  const [reason, setReason] = useState("");
  const [rescheduleState, rescheduleAction] = useActionState<ActionState, FormData>(rescheduleByBusinessAction, {});
  const status = STATUS[a.status];

  useEffect(() => {
    if (rescheduleState.ok) onDone();
  }, [rescheduleState, onDone]);

  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onDone();
    });

  const firstName = a.clientName.split(" ")[0];
  const when = `el ${longDate(a.date)} a las ${minutesToHHMM(a.start)} hs`;
  const reminderUrl = whatsappLink(a.clientPhone, `¡Hola ${firstName}! Te recordamos tu turno de ${a.serviceName} ${when} en ${businessName}. ¡Te esperamos!`);
  const cancelText = `Hola ${firstName}, te escribimos de ${businessName}: tuvimos que cancelar tu turno de ${a.serviceName} ${when}.${reason ? ` Motivo: ${reason}.` : ""} ${a.depositPaid && refund ? "Te devolvimos la seña. " : ""}¿Querés que busquemos otro horario?`;
  const cancelUrl = whatsappLink(a.clientPhone, cancelText);
  const active = a.status === "confirmed" || a.status === "pending_payment";

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{a.clientName}</p>
          {a.clientPhone && <p className="text-neutral-600">{a.clientPhone}</p>}
          {a.clientEmail && <p className="text-neutral-600">{a.clientEmail}</p>}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-neutral-50 p-3">
        <dt className="text-neutral-500">Servicio</dt>
        <dd>{a.serviceName}</dd>
        <dt className="text-neutral-500">Horario</dt>
        <dd className="first-letter:uppercase">
          {longDate(a.date)}, {minutesToHHMM(a.start)} a {minutesToHHMM(a.end)}
        </dd>
        <dt className="text-neutral-500">Precio</dt>
        <dd>{a.price}</dd>
        {a.deposit && (
          <>
            <dt className="text-neutral-500">Seña</dt>
            <dd>
              {a.deposit} {a.depositPaid ? "(pagada)" : a.depositRefunded ? "(devuelta)" : "(pendiente)"}
            </dd>
          </>
        )}
        <dt className="text-neutral-500">Origen</dt>
        <dd>{a.source === "online" ? "Reserva online" : "Cargado en el panel"}</dd>
      </dl>
      {a.notes && <p className="rounded-lg border border-neutral-200 p-3">📝 {a.notes}</p>}

      {result?.error && <Alert>{result.error}</Alert>}

      {mode === "view" && (
        <div className="flex flex-wrap gap-2">
          {reminderUrl && (
            <a
              href={reminderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-4 py-2.5 text-sm font-medium text-white"
            >
              <MessageCircle className="size-4" /> Recordatorio por WhatsApp
            </a>
          )}
          {a.status === "confirmed" && (
            <>
              <Button variant="secondary" loading={pending} onClick={() => run(() => setAppointmentStatusAction(a.id, "completed"))}>
                Marcar realizado
              </Button>
              <Button variant="secondary" loading={pending} onClick={() => run(() => setAppointmentStatusAction(a.id, "no_show"))}>
                Ausente
              </Button>
            </>
          )}
          {(a.status === "completed" || a.status === "no_show") && (
            <Button variant="secondary" loading={pending} onClick={() => run(() => setAppointmentStatusAction(a.id, "confirmed"))}>
              Volver a confirmado
            </Button>
          )}
          {active && (
            <>
              <Button variant="secondary" onClick={() => setMode("reschedule")}>
                Reprogramar
              </Button>
              <Button variant="secondary" className="text-red-600" onClick={() => setMode("cancel")}>
                Cancelar turno
              </Button>
            </>
          )}
        </div>
      )}

      {mode === "cancel" && (
        <div className="space-y-3 rounded-lg border border-red-200 p-3">
          <Field label="Motivo (opcional, se informa al cliente)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {a.depositPaid && <Checkbox checked={refund} onChange={(e) => setRefund(e.target.checked)} label={`Devolver la seña (${a.deposit}) por Mercado Pago`} />}
          {cancelUrl && (
            <a href={cancelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#128c4a] underline">
              <MessageCircle className="size-4" /> Avisarle por WhatsApp
            </a>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("view")}>
              Volver
            </Button>
            <Button variant="danger" loading={pending} onClick={() => run(() => cancelAppointmentByBusinessAction(a.id, a.depositPaid && refund, reason))}>
              Confirmar cancelación
            </Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <ActionForm action={rescheduleAction} className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-3">
          <input type="hidden" name="id" value={a.id} />
          <Field label="Fecha">
            <Input name="date" type="date" defaultValue={a.date} required />
          </Field>
          <Field label="Hora">
            <Input name="time" type="time" step={900} defaultValue={minutesToHHMM(a.start)} required />
          </Field>
          {professionals.length > 1 && (
            <Field label="Profesional" className="col-span-2">
              <Select name="professionalId" defaultValue={a.professionalId}>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Checkbox className="col-span-2" name="force" label="Permitir superposición con otros turnos" />
          <div className="col-span-2">
            <FormMessage state={rescheduleState} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Volver
            </Button>
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

function NewAppointmentForm({
  date,
  branchId,
  defaults,
  data,
  onDone,
}: {
  date: string;
  branchId: string;
  defaults: { professionalId?: string; time?: string };
  data: FormData_;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createManualAppointmentAction, {});
  const pros = data.professionals.filter((p) => p.branchIds.includes(branchId));
  const [professionalId, setProfessionalId] = useState(defaults.professionalId ?? pros[0]?.id ?? "");
  const pro = pros.find((p) => p.id === professionalId);
  const services = data.services.filter((s) => pro?.serviceIds.includes(s.id));
  const [chosenServiceId, setServiceId] = useState(services[0]?.id ?? "");
  // Si cambia el profesional y no presta el servicio elegido, se toma el primero que sí presta.
  const serviceId = services.some((s) => s.id === chosenServiceId) ? chosenServiceId : (services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchClientsAction>>>([]);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [newClient, setNewClient] = useState(false);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const t = setTimeout(() => searchClientsAction(query).then(setResults), 250);
    return () => clearTimeout(t);
  }, [query]);
  const visibleResults = query.trim().length >= 2 ? results : [];

  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="branchId" value={branchId} />
      <Field label="Profesional">
        <Select name="professionalId" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
          {pros.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Servicio">
        <Select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          {services.length === 0 && <option value="">Sin servicios asignados</option>}
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration} min)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha">
        <Input name="date" type="date" defaultValue={date} required />
      </Field>
      <Field label="Hora">
        <Input name="time" type="time" step={900} defaultValue={defaults.time ?? "10:00"} required />
      </Field>

      <div className="sm:col-span-2">
        <p className="mb-1 text-sm font-medium">Cliente</p>
        {client ? (
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <input type="hidden" name="clientId" value={client.id} />
            {client.name}
            <button type="button" className="text-xs underline" onClick={() => setClient(null)}>
              Cambiar
            </button>
          </div>
        ) : newClient ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input key="first" name="clientFirstName" placeholder="Nombre" required />
            <Input name="clientLastName" placeholder="Apellido" />
            <Input name="clientPhone" placeholder="Teléfono" />
            <Input name="clientEmail" type="email" placeholder="Email" />
            <button type="button" className="text-left text-xs underline" onClick={() => setNewClient(false)}>
              Buscar un cliente existente
            </button>
          </div>
        ) : (
          <div>
            <Input key="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, teléfono o email" />
            {visibleResults.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-neutral-200 text-sm">
                {visibleResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                      onClick={() => setClient({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim() })}
                    >
                      {c.firstName} {c.lastName} <span className="text-neutral-500">{c.phone ?? c.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="mt-1 text-xs underline" onClick={() => setNewClient(true)}>
              + Cliente nuevo
            </button>
          </div>
        )}
      </div>

      <Field label="Precio" hint={service ? `Precio de lista: $ ${service.price}` : undefined}>
        <Input name="price" type="number" min={0} placeholder={service ? String(service.price) : ""} />
      </Field>
      <Field label="Notas">
        <Textarea name="notes" rows={1} className="min-h-10" />
      </Field>
      <Checkbox name="force" label="Permitir superposición con otros turnos" />
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton disabled={!serviceId}>Agendar turno</SubmitButton>
      </div>
    </ActionForm>
  );
}
