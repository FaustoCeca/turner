import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing-shell";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

// Textos base: deben ser revisados por un abogado antes de publicar el servicio.
const DOCS: Record<string, { title: string; body: string[] }> = {
  terminos: {
    title: "Términos y condiciones",
    body: [
      `${appName} es una plataforma que permite a negocios publicar su agenda y a sus clientes reservar turnos online.`,
      "Cada negocio es responsable de los servicios que ofrece, de sus precios, de su política de señas y cancelaciones y de la atención brindada.",
      "Las señas se abonan a través de Mercado Pago y se acreditan en la cuenta del negocio. Las devoluciones se rigen por la política configurada por cada negocio.",
      "El usuario se compromete a brindar datos verdaderos y a mantener la confidencialidad de su contraseña.",
      "Podemos suspender cuentas que hagan un uso abusivo o fraudulento de la plataforma.",
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    body: [
      "Recopilamos los datos necesarios para gestionar tus turnos: nombre, email, teléfono e historial de reservas.",
      "Compartimos tus datos únicamente con los negocios en los que reservás, para que puedan brindarte el servicio.",
      "No almacenamos datos de tarjetas: los pagos se procesan en Mercado Pago.",
      "Podés solicitar el acceso, rectificación o eliminación de tus datos escribiéndonos (Ley 25.326 de Protección de Datos Personales).",
    ],
  },
};

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = DOCS[(await params).doc];
  return doc ? { title: doc.title } : {};
}

export default async function LegalPage({ params }: Props) {
  const doc = DOCS[(await params).doc];
  if (!doc) notFound();
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-bold">{doc.title}</h1>
        <div className="mt-6 space-y-4 text-neutral-700">
          {doc.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
