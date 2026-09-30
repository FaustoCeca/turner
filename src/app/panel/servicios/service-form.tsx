"use client";

import { useActionState, useState } from "react";
import { FormMessage, Section, WeekdayPicker } from "@/components/panel-ui";
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import type { Service } from "@/db/schema";
import { saveServiceAction, type ActionState } from "../actions";

type Pro = { id: string; name: string; assigned: boolean; weekdays: number[] };

export function ServiceForm({
  service,
  professionals,
  businessDepositPercent,
  requireDeposit,
  first,
}: {
  service: Service | null;
  professionals: Pro[];
  businessDepositPercent: number;
  requireDeposit: boolean;
  first?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveServiceAction, {});
  const [duration, setDuration] = useState(service?.durationMinutes ?? 30);
  const [blocking, setBlocking] = useState(service?.blockingMinutes ?? 30);
  const [assigned, setAssigned] = useState(new Set(professionals.filter((p) => p.assigned || !service).map((p) => p.id)));

  return (
    <form action={action} className="space-y-5">
      {service && <input type="hidden" name="id" value={service.id} />}
      {first && <input type="hidden" name="first" value="1" />}

      <Section title="Datos del servicio">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <Input name="name" defaultValue={service?.name} placeholder="Ej: Corte de cabello" required />
          </Field>
          <Field label="Modalidad">
            <Select name="modality" defaultValue={service?.modality ?? "Presencial"}>
              <option>Presencial</option>
              <option>Virtual</option>
              <option>A domicilio</option>
            </Select>
          </Field>
          <Field label="Categoría (opcional)" hint="Agrupa los servicios en la página de reservas">
            <Input name="category" defaultValue={service?.category ?? ""} placeholder="Ej: Cortes" />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <Textarea name="description" defaultValue={service?.description ?? ""} rows={3} />
          </Field>
          <Field label="A tener en cuenta" hint="Se muestra al reservar y en la confirmación del turno (ej. llegar 10 minutos antes)." className="sm:col-span-2">
            <Textarea name="notes" defaultValue={service?.notes ?? ""} rows={3} />
          </Field>
        </div>
      </Section>

      <Section title="Precio y duración">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Precio">
            <Input name="price" type="number" min={0} step={1} defaultValue={service?.price ?? 0} />
          </Field>
          <Field label="Duración (min)" hint="Lo que ve el cliente">
            <Input
              name="durationMinutes"
              type="number"
              min={5}
              max={720}
              step={5}
              value={duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (blocking === duration) setBlocking(v);
                setDuration(v);
              }}
              required
            />
          </Field>
          <Field label="Ocupa en la agenda (min)" hint="Incluye margen para limpieza o preparación">
            <Input name="blockingMinutes" type="number" min={5} max={720} step={5} value={blocking} onChange={(e) => setBlocking(Number(e.target.value))} />
          </Field>
        </div>
        <Checkbox className="mt-4" name="priceTBD" defaultChecked={service?.priceTBD} label="Precio a definir" hint="No se muestra el precio; la seña será el monto mínimo configurado." />
      </Section>

      <Section
        title="Seña"
        description={
          requireDeposit
            ? `Por defecto se cobra el ${businessDepositPercent}% configurado en Reservas. Podés usar otro porcentaje para este servicio.`
            : "El cobro de señas está desactivado. Activalo en Configuración → Reservas."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox name="depositEnabled" defaultChecked={service?.depositEnabled ?? true} label="Exigir seña en este servicio" />
          <Field label="Porcentaje de seña (opcional)" hint={`Vacío = ${businessDepositPercent}%`}>
            <Input name="depositPercent" type="number" min={0} max={100} defaultValue={service?.depositPercent ?? ""} placeholder={String(businessDepositPercent)} />
          </Field>
        </div>
      </Section>

      <Section title="Profesionales" description="Quiénes prestan este servicio y qué días lo ofrecen.">
        {professionals.length === 0 && <p className="text-sm text-neutral-600">Primero cargá profesionales.</p>}
        <div className="divide-y divide-neutral-100">
          {professionals.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Checkbox
                name={`pro_${p.id}`}
                checked={assigned.has(p.id)}
                onChange={(e) => {
                  const next = new Set(assigned);
                  if (e.target.checked) next.add(p.id);
                  else next.delete(p.id);
                  setAssigned(next);
                }}
                label={p.name}
              />
              <WeekdayPicker name={`days_${p.id}`} defaultValue={p.weekdays} disabled={!assigned.has(p.id)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Visibilidad">
        <div className="grid gap-3 sm:grid-cols-3">
          <Checkbox name="isActive" defaultChecked={service?.isActive ?? true} label="Activo" />
          <Checkbox name="isOnline" defaultChecked={service?.isOnline ?? true} label="Reservable online" hint="Si no, sólo lo agendás desde el panel" />
          <Field label="Orden">
            <Input name="order" type="number" defaultValue={service?.order ?? 0} />
          </Field>
        </div>
      </Section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>{service ? "Guardar cambios" : "Crear servicio"}</SubmitButton>
      </div>
    </form>
  );
}
