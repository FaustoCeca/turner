"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage } from "@/components/panel-ui";
import { Field, Input, Select, SubmitButton } from "@/components/ui";
import { saveCouponAction, type ActionState } from "../actions";

export function CouponForm() {
  const [state, action] = useActionState<ActionState, FormData>(saveCouponAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Código" className="col-span-2">
        <Input name="code" placeholder="BIENVENIDA" className="uppercase" required />
      </Field>
      <Field label="Tipo">
        <Select name="discountType" defaultValue="percent">
          <option value="percent">Porcentaje</option>
          <option value="fixed">Monto fijo</option>
        </Select>
      </Field>
      <Field label="Valor">
        <Input name="value" type="number" min={1} required />
      </Field>
      <Field label="Desde (opcional)">
        <Input name="validFrom" type="date" />
      </Field>
      <Field label="Hasta (opcional)">
        <Input name="validUntil" type="date" />
      </Field>
      <Field label="Usos máximos (opcional)" className="col-span-2">
        <Input name="maxUses" type="number" min={1} placeholder="Ilimitado" />
      </Field>
      <div className="col-span-2">
        <FormMessage state={state} />
      </div>
      <SubmitButton className="col-span-2">Crear cupón</SubmitButton>
    </form>
  );
}
