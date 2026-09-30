"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/panel-ui";
import { Field, Input, Select, SubmitButton } from "@/components/ui";
import { createBlockAction, type ActionState } from "./actions";

/** Formulario para bloquear un rango de fechas/horas (todo el negocio o un profesional). */
export function BlockForm({
  professionals,
  branches,
  fixedProfessionalId,
  defaultDate,
  onDone,
}: {
  professionals: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  fixedProfessionalId?: string;
  defaultDate?: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev: ActionState, fd: FormData) => {
    const res = await createBlockAction(prev, fd);
    if (res.ok) onDone?.();
    return res;
  }, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      {fixedProfessionalId ? (
        <input type="hidden" name="professionalId" value={fixedProfessionalId} />
      ) : (
        <Field label="Profesional" className="sm:col-span-2">
          <Select name="professionalId" defaultValue="">
            <option value="">Todo el negocio</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {branches.length > 1 && (
        <Field label="Sucursal" className="sm:col-span-2">
          <Select name="branchId" defaultValue="">
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Desde (fecha)">
        <Input name="fromDate" type="date" defaultValue={defaultDate} required />
      </Field>
      <Field label="Hora" hint="Vacío = todo el día">
        <Input name="fromTime" type="time" step={900} />
      </Field>
      <Field label="Hasta (fecha)">
        <Input name="toDate" type="date" defaultValue={defaultDate} />
      </Field>
      <Field label="Hora">
        <Input name="toTime" type="time" step={900} />
      </Field>
      <Field label="Motivo (opcional)" className="sm:col-span-3">
        <Input name="reason" placeholder="Vacaciones, feriado, trámite…" />
      </Field>
      <div className="flex items-end">
        <SubmitButton className="w-full" variant="dark">
          Bloquear
        </SubmitButton>
      </div>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
