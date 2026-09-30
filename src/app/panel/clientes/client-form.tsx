"use client";

import { useActionState, useEffect } from "react";
import { FormMessage } from "@/components/panel-ui";
import { Checkbox, Field, Input, SubmitButton, Textarea, ActionForm } from "@/components/ui";
import type { Client } from "@/db/schema";
import { saveClientAction, type ActionState } from "../actions";

export function ClientForm({ client, onSaved }: { client: Client | null; onSaved?: (id: string) => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveClientAction, {});
  useEffect(() => {
    if (state.ok && state.id) onSaved?.(state.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      {client && <input type="hidden" name="id" value={client.id} />}
      <Field label="Nombre">
        <Input name="firstName" defaultValue={client?.firstName} required />
      </Field>
      <Field label="Apellido">
        <Input name="lastName" defaultValue={client?.lastName} />
      </Field>
      <Field label="Teléfono">
        <Input name="phone" type="tel" defaultValue={client?.phone ?? ""} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={client?.email ?? ""} />
      </Field>
      <Field label="Notas internas" className="sm:col-span-2" hint="Sólo las ve tu equipo">
        <Textarea name="notes" defaultValue={client?.notes ?? ""} rows={3} />
      </Field>
      <Checkbox name="depositExempt" defaultChecked={client?.depositExempt} label="No exigirle seña" hint="Puede reservar online sin pagar seña" />
      <Checkbox name="isBlocked" defaultChecked={client?.isBlocked} label="Bloquear reservas online" hint="No podrá reservar desde tu página" />
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}
