import {
  BarChart3,
  BellRing,
  CalendarCheck2,
  CreditCard,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

const FEATURES = [
  { icon: CalendarCheck2, title: "Agenda online 24/7", text: "Tus clientes eligen servicio, profesional y horario desde el celular, a cualquier hora." },
  { icon: CreditCard, title: "Cobro de señas", text: "Cobrá una seña con Mercado Pago al reservar. La plata va directo a tu cuenta, sin comisiones nuestras." },
  { icon: BellRing, title: "Recordatorios", text: "El turno queda en el calendario del cliente con alarma, y vos le mandás el recordatorio por WhatsApp con un click." },
  { icon: Users, title: "Gestión de clientes", text: "Historial de cada cliente, notas internas, clientes sin seña y exportación a Excel." },
  { icon: Store, title: "Sucursales y equipo", text: "Varias sucursales, cada profesional con sus horarios, servicios y bloqueos de agenda." },
  { icon: BarChart3, title: "Estadísticas", text: "Turnos, facturación, señas cobradas y ausentismo por mes, servicio y profesional." },
];

const STEPS = [
  ["Creá tu cuenta", "Cargá el nombre de tu negocio y tu dirección. Te damos tu link de reservas al instante."],
  ["Cargá servicios y horarios", "Precio, duración y seña de cada servicio, y los horarios de cada profesional."],
  ["Compartí tu link", "Ponelo en tu Instagram, WhatsApp o web. Las reservas caen solas en tu agenda."],
];

export default function HomePage() {
  const demo = process.env.NEXT_PUBLIC_DEMO_SLUG;
  return (
    <MarketingShell>
      <section className="bg-brand-dark pb-20 pt-14 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-[#ffe600]">Turnos online para tu negocio</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Dejá de coordinar turnos por WhatsApp</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/80">
            Tus clientes reservan solos, pagan la seña con Mercado Pago y reciben recordatorios. Vos te ocupás de atender.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/registro?negocio" className="rounded-lg bg-brand px-6 py-3 text-lg font-medium text-white shadow-lg hover:brightness-110">
              Probá gratis 14 días
            </Link>
            {demo && (
              <Link href={`/${demo}`} className="rounded-lg border border-white/30 px-6 py-3 text-lg font-medium text-white hover:bg-white/10">
                Ver una página de ejemplo
              </Link>
            )}
          </div>
          <p className="mt-4 text-sm text-white/60">Sin tarjeta · Todas las funciones · Profesionales ilimitados durante la prueba</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Todo lo que necesitás para tu agenda</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(93,93,239,0.10)]">
              <span className="brand-soft inline-flex size-11 items-center justify-center rounded-xl text-brand">
                <Icon className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-neutral-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-3xl font-bold">Empezá en 3 pasos</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-neutral-200 p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">Para barberías, peluquerías, estética, consultorios y más</h2>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
          Cualquier negocio que trabaje con turnos: salud, belleza, clases, canchas, talleres y profesionales independientes.
        </p>
        <Link href="/registro?negocio" className="mt-8 inline-block rounded-lg bg-brand px-6 py-3 text-lg font-medium text-white">
          Crear mi agenda gratis
        </Link>
      </section>
    </MarketingShell>
  );
}
