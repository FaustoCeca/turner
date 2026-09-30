"use client";

import { useActionState, useState } from "react";
import { Alert, Field, Input, Select, SubmitButton } from "@/components/ui";
import { createBusinessAction, type OnboardingState } from "./actions";

export const CATEGORIES = [
  "Barbería", "Peluquería", "Centro de estética", "Uñas", "Cejas y pestañas", "Depilación", "Spa y masajes",
  "Consultorio médico", "Odontología", "Kinesiología", "Psicología", "Nutrición", "Tatuajes", "Peluquería canina",
  "Clases y asesorías", "Canchas y espacios", "Taller mecánico", "Otro",
];

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function OnboardingForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState<OnboardingState, FormData>(createBusinessAction, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <Field label="Nombre del negocio">
        <Input
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          placeholder="Ej: La Barbería"
          required
        />
      </Field>
      <Field label="Dirección de tu página de reservas" hint={`${appUrl}/${slug || "tu-negocio"}`}>
        <Input
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(toSlug(e.target.value));
          }}
          placeholder="la-barberia"
          required
        />
      </Field>
      <Field label="Rubro">
        <Select name="category" defaultValue="">
          <option value="" disabled>
            Elegí un rubro
          </option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Dirección" className="col-span-2">
          <Input name="address" placeholder="Salta 1724" required />
        </Field>
        <Field label="Ciudad">
          <Input name="city" placeholder="Rosario" />
        </Field>
      </div>
      <Field label="WhatsApp del negocio (opcional)">
        <Input name="whatsapp" type="tel" placeholder="+54 9 341 123 4567" />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <SubmitButton className="w-full">Crear mi negocio</SubmitButton>
    </form>
  );
}
