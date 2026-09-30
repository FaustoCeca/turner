import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = { title: "Preguntas frecuentes" };

const FAQ: [string, string][] = [
  ["¿Para qué negocios sirve?", "Para cualquier negocio o profesional que trabaje con turnos: barberías, peluquerías, estética, uñas, consultorios, kinesiología, psicología, clases, canchas, talleres y más."],
  ["¿Tengo que cargar una tarjeta para probar?", "No. La prueba de 14 días es gratis y sin datos de pago. Si no te suscribís, simplemente dejás de recibir reservas; tus datos quedan guardados."],
  ["¿Me cobran por cada integrante?", "Sólo por los profesionales que atienden turnos. Los administradores no suman al precio."],
  ["¿Es obligatorio cobrar seña?", "No. Podés no exigir seña, exigirla sólo en algunos servicios, o eximir a clientes puntuales."],
  ["¿Cobran comisión por las señas?", "No. La seña se acredita directo en tu cuenta de Mercado Pago. Mercado Pago cobra su comisión habitual."],
  ["¿Qué pasa si el cliente no paga la seña?", "El horario queda reservado unos minutos (lo configurás vos). Si no se registra el pago, se libera automáticamente."],
  ["¿El cliente puede cancelar o cambiar el turno?", "Sí, desde “Mis turnos”, respetando la anticipación mínima y la cantidad de cambios que configures. Si cancela a tiempo, la seña se devuelve automáticamente."],
  ["¿Puedo tener varias sucursales?", "Sí. Cada profesional puede atender en una o varias sucursales con horarios distintos, y nunca se le superponen turnos."],
  ["¿Tengo que descargar una app?", "No. Funciona desde el navegador en el celular, tablet o computadora."],
];

export default function FaqPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-center text-4xl font-bold">Preguntas frecuentes</h1>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-xl bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-bold">
                <span className="mr-2 inline-block text-brand transition group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 text-neutral-700">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
