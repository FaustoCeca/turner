"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, Section, WeekdayPicker } from "@/components/panel-ui";
import { Checkbox, Field, Input, SubmitButton, Textarea } from "@/components/ui";
import type { Professional } from "@/db/schema";
import { saveProfessionalAction, type ActionState } from "../actions";
import { ScheduleEditor, type BranchScheduleState } from "./schedule-editor";

export function ProfessionalForm({
  professional,
  branches,
  schedules,
  services,
}: {
  professional: Professional | null;
  branches: { id: string; label: string }[];
  schedules: BranchScheduleState;
  services: { id: string; name: string; assigned: boolean; weekdays: number[] }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(saveProfessionalAction, {});
  const [value, setValue] = useState(schedules);
  const [assigned, setAssigned] = useState(new Set(services.filter((s) => s.assigned).map((s) => s.id)));

  useEffect(() => {
    if (state.ok && !professional && state.id) router.replace(`/panel/profesionales/${state.id}`);
  }, [state, professional, router]);

  return (
    <form action={action} className="space-y-5">
      {professional && <input type="hidden" name="id" value={professional.id} />}
      <Section title="Datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input name="firstName" defaultValue={professional?.firstName} required />
          </Field>
          <Field label="Apellido">
            <Input name="lastName" defaultValue={professional?.lastName} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={professional?.email ?? ""} />
          </Field>
          <Field label="Teléfono">
            <Input name="phone" defaultValue={professional?.phone ?? ""} />
          </Field>
          <Field label="Foto (URL)" hint="Link https a una imagen cuadrada" className="sm:col-span-2">
            <Input name="avatarUrl" type="url" defaultValue={professional?.avatarUrl ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Presentación (opcional)" className="sm:col-span-2">
            <Textarea name="bio" defaultValue={professional?.bio ?? ""} rows={2} />
          </Field>
          <Checkbox name="isActive" defaultChecked={professional?.isActive ?? true} label="Activo (recibe reservas)" />
          <Field label="Orden">
            <Input name="order" type="number" defaultValue={professional?.order ?? 0} />
          </Field>
        </div>
      </Section>

      <Section title="Sucursales y horarios" description="Marcá dónde atiende y en qué franjas horarias. Podés cargar horarios cortados (ej. 9 a 13 y 16 a 20).">
        <ScheduleEditor branches={branches} value={value} onChange={setValue} />
      </Section>

      <Section title="Servicios que presta" description="Y en qué días de la semana los ofrece.">
        {services.length === 0 && <p className="text-sm text-neutral-600">Todavía no cargaste servicios.</p>}
        <div className="divide-y divide-neutral-100">
          {services.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Checkbox
                name={`svc_${s.id}`}
                checked={assigned.has(s.id)}
                onChange={(e) => {
                  const next = new Set(assigned);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  setAssigned(next);
                }}
                label={s.name}
              />
              <WeekdayPicker name={`svcdays_${s.id}`} defaultValue={s.weekdays} disabled={!assigned.has(s.id)} />
            </div>
          ))}
        </div>
      </Section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>{professional ? "Guardar cambios" : "Crear profesional"}</SubmitButton>
      </div>
    </form>
  );
}
