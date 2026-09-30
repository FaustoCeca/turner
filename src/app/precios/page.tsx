import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { formatMoney } from "@/lib/pricing";
import { ANNUAL_DISCOUNT, PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Precios" };

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h1 className="text-center text-4xl font-bold">Planes simples, por profesional</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-neutral-600">
          Sólo pagás por quienes atienden turnos. Probá 14 días gratis con todas las funciones. Pagando anual tenés {Math.round(ANNUAL_DISCOUNT * 100)}% de descuento.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <div key={plan.id} className={`flex flex-col rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(93,93,239,0.10)] ${i === 1 ? "ring-2 ring-brand" : ""}`}>
              {i === 1 && <span className="mb-2 self-start rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">Más elegido</span>}
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="mt-3">
                <span className="text-3xl font-bold">{formatMoney(plan.pricePerProfessional)}</span>
                <span className="text-sm text-neutral-500"> / mes por profesional</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-brand" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/registro?negocio" className="mt-6 rounded-lg bg-brand py-2.5 text-center font-medium text-white">
                Probar gratis
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-neutral-500">
          No cobramos comisión por turno ni por seña. Mercado Pago cobra su comisión habitual por cada cobro.
        </p>
      </section>
    </MarketingShell>
  );
}
