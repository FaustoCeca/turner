"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CATEGORIES } from "@/app/negocio/nuevo/onboarding-form";
import { FormMessage, Section } from "@/components/panel-ui";
import { Alert, Badge, Button, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui";
import type { PublicBusiness } from "@/lib/public";
import {
  disconnectMpAction,
  saveAppearanceAction,
  saveBookingSettingsAction,
  saveGeneralSettingsAction,
  saveMpTokenAction,
  type ActionState,
} from "../actions";
import { subscribeAction } from "./subscription-actions";
import { PLANS } from "@/lib/plans";

type Settings = PublicBusiness & {
  category: string | null;
  maxDaysInFuture: number;
  minAnticipationMinutes: number;
  minAnticipationEditMinutes: number;
  maxClientEdits: number;
  autoRefund: boolean;
  refundMinAnticipationMinutes: number;
  slotMinutes: number[];
  holdMinutes: number;
  depositPercent: number;
  depositMinAmount: number;
  mpConnected: boolean;
  mpUserId: string | null;
  mpLiveMode: boolean | null;
  mpOauth: boolean;
  mpMock: boolean;
  trialDays: number;
  subscriptionStatus: string;
};

const ANTICIPATION = [
  [0, "Sin anticipación"],
  [30, "30 minutos"],
  [60, "1 hora"],
  [120, "2 horas"],
  [180, "3 horas"],
  [360, "6 horas"],
  [480, "8 horas"],
  [720, "12 horas"],
  [1440, "24 horas"],
  [2880, "48 horas"],
  [4320, "72 horas"],
] as const;

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Asuncion",
  "America/Sao_Paulo",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "Europe/Madrid",
];

function AnticipationSelect({ name, value }: { name: string; value: number }) {
  const known = ANTICIPATION.some(([m]) => m === value);
  return (
    <Select name={name} defaultValue={value}>
      {!known && <option value={value}>{value} minutos</option>}
      {ANTICIPATION.map(([m, label]) => (
        <option key={m} value={m}>
          {label}
        </option>
      ))}
    </Select>
  );
}

export function SettingsForms({
  business: b,
  isOwner,
  appUrl,
  mpStatus,
}: {
  business: Settings;
  isOwner: boolean;
  appUrl: string;
  mpStatus: string | null;
}) {
  const [general, generalAction] = useActionState<ActionState, FormData>(saveGeneralSettingsAction, {});
  const [appearance, appearanceAction] = useActionState<ActionState, FormData>(saveAppearanceAction, {});
  const [booking, bookingAction] = useActionState<ActionState, FormData>(saveBookingSettingsAction, {});
  const [mp, mpAction] = useActionState<ActionState, FormData>(saveMpTokenAction, {});
  const [sub, subAction] = useActionState<ActionState, FormData>(subscribeAction, {});
  const [colors, setColors] = useState({ primaryColor: b.primaryColor.trim(), secondaryColor: b.secondaryColor.trim(), backgroundColor: b.backgroundColor.trim() });
  const trialDays = b.trialDays;

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          ["#general", "Datos"],
          ["#apariencia", "Apariencia"],
          ["#reservas", "Reservas"],
          ["#senas", "Señas"],
          ["#mercadopago", "Mercado Pago"],
          ["#suscripcion", "Suscripción"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-neutral-300 bg-white px-3 py-1 hover:border-brand">
            {label}
          </a>
        ))}
      </nav>

      <Section id="general" title="Datos del negocio">
        <form action={generalAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input name="name" defaultValue={b.name} required />
          </Field>
          <Field label="Dirección de tu página" hint={`${appUrl.replace(/^https?:\/\//, "")}/${b.slug}`}>
            <Input name="slug" defaultValue={b.slug} required />
          </Field>
          <Field label="Rubro">
            <Select name="category" defaultValue={b.category ?? ""}>
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Frase o slogan">
            <Input name="slogan" defaultValue={b.slogan ?? ""} />
          </Field>
          <Field label="Logo (URL https)" className="sm:col-span-2">
            <Input name="logoUrl" type="url" defaultValue={b.logoUrl ?? ""} placeholder="https://…/logo.png" />
          </Field>
          <Field label="WhatsApp">
            <Input name="whatsapp" defaultValue={b.whatsapp ?? ""} placeholder="+54 9 341 123 4567" />
          </Field>
          <Field label="Instagram">
            <Input name="instagram" defaultValue={b.instagram ?? ""} placeholder="instagram.com/tu.negocio" />
          </Field>
          <Field label="Facebook">
            <Input name="facebook" defaultValue={b.facebook ?? ""} />
          </Field>
          <Field label="Sitio web">
            <Input name="website" defaultValue={b.website ?? ""} />
          </Field>
          <Field label="Zona horaria">
            <Select name="timezone" defaultValue={b.timezone}>
              {[...new Set([b.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <FormMessage state={general} />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <SubmitButton>Guardar datos</SubmitButton>
          </div>
        </form>
      </Section>

      <Section id="apariencia" title="Apariencia" description="Colores de tu página de reservas.">
        <form action={appearanceAction} className="grid gap-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            {(
              [
                ["primaryColor", "Color principal (botones y precios)"],
                ["secondaryColor", "Color del encabezado"],
                ["backgroundColor", "Color de fondo"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="color"
                  name={key}
                  value={colors[key]}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-neutral-300"
                />
                {label}
                <code className="text-xs text-neutral-500">{colors[key]}</code>
              </label>
            ))}
            <FormMessage state={appearance} />
            <SubmitButton>Guardar colores</SubmitButton>
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-200" aria-hidden>
            <div className="px-3 py-3 text-sm font-bold text-white" style={{ background: colors.secondaryColor }}>
              {b.name}
              <span className="block text-[10px] text-[#ffe600]">NUEVO TURNO</span>
            </div>
            <div className="space-y-2 p-3" style={{ background: colors.backgroundColor }}>
              <div className="flex justify-between rounded-md border border-neutral-200 bg-white p-2 text-xs">
                <b>Corte de cabello</b>
                <b style={{ color: colors.primaryColor }}>$ 19.000</b>
              </div>
              <div className="rounded-md py-2 text-center text-xs text-white" style={{ background: colors.primaryColor }}>
                CONTINUAR
              </div>
            </div>
          </div>
        </form>
      </Section>

      <form action={bookingAction} className="space-y-5">
        <Section id="reservas" title="Reservas online">
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox name="isOnline" defaultChecked={b.isOnline} label="Aceptar reservas online" hint="Si lo desactivás, tu página muestra que las reservas están pausadas." />
            <Checkbox name="showPrices" defaultChecked={b.showPrices} label="Mostrar precios en la página de reservas" />
            <Field label="¿Con cuántos días de anticipación se puede reservar?">
              <Input name="maxDaysInFuture" type="number" min={1} max={365} defaultValue={b.maxDaysInFuture} />
            </Field>
            <Field label="Anticipación mínima para reservar">
              <AnticipationSelect name="minAnticipationMinutes" value={b.minAnticipationMinutes} />
            </Field>
            <Field label="Horarios de inicio de turno" hint="Minutos de cada hora en los que puede empezar un turno.">
              <div className="flex gap-3 pt-1">
                {[0, 15, 30, 45].map((m) => (
                  <Checkbox key={m} name="slotMinutes" value={m} defaultChecked={b.slotMinutes.includes(m)} label={`:${String(m).padStart(2, "0")}`} />
                ))}
              </div>
            </Field>
            <Field label="Tiempo para pagar la seña (minutos)" hint="Durante ese tiempo el horario queda reservado.">
              <Input name="holdMinutes" type="number" min={5} max={120} defaultValue={b.holdMinutes} />
            </Field>
          </div>
        </Section>

        <Section title="Cambios y cancelaciones del cliente">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anticipación mínima para cancelar o modificar online">
              <AnticipationSelect name="minAnticipationEditMinutes" value={b.minAnticipationEditMinutes} />
            </Field>
            <Field label="Cantidad máxima de modificaciones por turno">
              <Input name="maxClientEdits" type="number" min={0} max={20} defaultValue={b.maxClientEdits} />
            </Field>
            <Checkbox name="autoRefund" defaultChecked={b.autoRefund} label="Devolver la seña automáticamente si el cliente cancela a tiempo" />
            <Field label="…siempre que cancele con al menos">
              <AnticipationSelect name="refundMinAnticipationMinutes" value={b.refundMinAnticipationMinutes} />
            </Field>
          </div>
        </Section>

        <Section id="senas" title="Señas" description="Reducí el ausentismo cobrando una parte por adelantado con Mercado Pago.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Checkbox className="sm:col-span-3" name="requireDeposit" defaultChecked={b.requireDeposit} label="Exigir seña para reservar online" hint="Podés desactivarla por servicio o eximir a clientes puntuales." />
            <Field label="Porcentaje de seña por defecto">
              <Input name="depositPercent" type="number" min={0} max={100} defaultValue={b.depositPercent} />
            </Field>
            <Field label="Seña mínima ($)">
              <Input name="depositMinAmount" type="number" min={0} defaultValue={b.depositMinAmount} />
            </Field>
          </div>
          {b.requireDeposit && !b.mpConnected && (
            <div className="mt-4">
              <Alert tone="yellow">
                Exigís seña pero todavía no vinculaste Mercado Pago{b.mpMock ? " (en desarrollo se usa un pago simulado)" : ""}.
              </Alert>
            </div>
          )}
        </Section>

        <Section title="Términos y condiciones" description="Si los completás, el cliente debe aceptarlos para reservar.">
          <Textarea name="termsAndConditions" defaultValue={b.termsAndConditions ?? ""} rows={5} placeholder="Ej: Tolerancia de 10 minutos. Cancelaciones con 8 horas de anticipación…" />
        </Section>

        <FormMessage state={booking} />
        <div className="flex justify-end">
          <SubmitButton>Guardar configuración de reservas</SubmitButton>
        </div>
      </form>

      <Section id="mercadopago" title="Mercado Pago" description="Las señas se acreditan directamente en tu cuenta. No cobramos comisión.">
        {mpStatus === "ok" && <div className="mb-3"><Alert tone="green">¡Cuenta vinculada!</Alert></div>}
        {mpStatus === "error" && <div className="mb-3"><Alert>No pudimos vincular la cuenta. Intentá nuevamente.</Alert></div>}
        {b.mpConnected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <Badge tone="green">Vinculada</Badge> Cuenta #{b.mpUserId} {b.mpLiveMode === false && <Badge tone="yellow">Modo prueba</Badge>}
            </p>
            {isOwner && (
              <form action={disconnectMpAction}>
                <Button variant="secondary" className="text-red-600">
                  Desvincular
                </Button>
              </form>
            )}
          </div>
        ) : !isOwner ? (
          <p className="text-sm text-neutral-600">Sólo el dueño del negocio puede vincular Mercado Pago.</p>
        ) : (
          <div className="space-y-4">
            {b.mpOauth && (
              // Navegación completa a un route handler que redirige a Mercado Pago (no es una página).
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/api/mercadopago/connect" className="inline-flex items-center gap-2 rounded-lg bg-[#009ee3] px-4 py-2.5 text-sm font-medium text-white">
                Vincular con Mercado Pago
              </a>
            )}
            <details className="text-sm" open={!b.mpOauth}>
              <summary className="cursor-pointer font-medium">Vincular con Access Token</summary>
              <p className="mt-2 text-neutral-600">
                Copiá tu Access Token desde <i>Mercado Pago Developers → Tus integraciones → Credenciales de producción</i>. Para pruebas podés usar uno que empiece con TEST-.
              </p>
              <form action={mpAction} className="mt-3 flex flex-wrap gap-2">
                <Input name="accessToken" placeholder="APP_USR-…" className="flex-1" autoComplete="off" required />
                <SubmitButton>Vincular</SubmitButton>
              </form>
              <div className="mt-2">
                <FormMessage state={mp} />
              </div>
            </details>
          </div>
        )}
      </Section>

      <Section id="suscripcion" title="Suscripción">
        {b.subscriptionStatus === "active" ? (
          <p className="text-sm">
            <Badge tone="green">Activa</Badge> ¡Gracias por confiar en nosotros!
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {b.subscriptionStatus === "pending"
                ? "Estamos esperando la confirmación del pago de tu suscripción."
                : trialDays > 0
                  ? `Te quedan ${trialDays} días de prueba gratis. Suscribite cuando quieras: se cobra con Mercado Pago y podés cancelar en cualquier momento.`
                  : "Tu prueba gratis terminó. Elegí un plan para seguir recibiendo reservas."}{" "}
              <Link href="/precios" className="underline" target="_blank">
                Comparar planes
              </Link>
            </p>
            {isOwner && (
              <form action={subAction} className="flex flex-wrap items-end gap-3">
                <Field label="Plan">
                  <Select name="plan" defaultValue="profesional">
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.pricePerProfessional.toLocaleString("es-AR")} por profesional)
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Profesionales">
                  <Input name="professionals" type="number" min={1} defaultValue={1} className="w-24" />
                </Field>
                <SubmitButton>Suscribirme</SubmitButton>
              </form>
            )}
            <FormMessage state={sub} />
          </div>
        )}
      </Section>
    </div>
  );
}
