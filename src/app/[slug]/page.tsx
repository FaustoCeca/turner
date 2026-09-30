import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlowLoader } from "@/components/booking/booking-flow-loader";
import { BusinessShell, whatsappUrl } from "@/components/business-shell";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessBySlug } from "@/lib/bookings";
import { getBookableServices, toPublicBusiness } from "@/lib/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(await getDb(), slug);
  if (!business) return {};
  return {
    title: { absolute: `${business.name} | Nuevo turno` },
    description: business.slogan ?? `Reservá tu turno online en ${business.name}`,
  };
}

export default async function BusinessBookingPage({ params }: Props) {
  const { slug } = await params;
  const db = await getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) notFound();

  const [services, user] = await Promise.all([getBookableServices(db, business.id), getCurrentUser()]);
  const pub = toPublicBusiness(business);

  return (
    <BusinessShell business={pub} user={user}>
      {business.isOnline ? (
        <BookingFlowLoader business={pub} services={services} user={user} />
      ) : (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">Las reservas online están pausadas</h1>
          <p className="mt-2 text-neutral-600">{business.name} no está tomando turnos online en este momento.</p>
          {business.whatsapp && (
            <a href={whatsappUrl(business.whatsapp)} className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-white">
              Escribir por WhatsApp
            </a>
          )}
        </div>
      )}
    </BusinessShell>
  );
}
