import "server-only";
import { and, asc, eq, exists } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  branches,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  type Business,
  type Service,
} from "@/db/schema";

/** Datos del negocio aptos para enviar al navegador (sin tokens ni configuración interna). */
export function toPublicBusiness(b: Business) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    slogan: b.slogan,
    logoUrl: b.logoUrl,
    currency: b.currency,
    timezone: b.timezone,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    backgroundColor: b.backgroundColor,
    whatsapp: b.whatsapp,
    instagram: b.instagram,
    facebook: b.facebook,
    website: b.website,
    termsAndConditions: b.termsAndConditions,
    isOnline: b.isOnline,
    showPrices: b.showPrices,
    requireDeposit: b.requireDeposit,
  };
}
export type PublicBusiness = ReturnType<typeof toPublicBusiness>;

export function toPublicService(s: Service) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    notes: s.notes,
    category: s.category,
    modality: s.modality,
    price: s.price,
    priceTBD: s.priceTBD,
    durationMinutes: s.durationMinutes,
    blockingMinutes: s.blockingMinutes,
  };
}
export type PublicService = ReturnType<typeof toPublicService>;

/** Servicios reservables online: activos y con al menos un profesional activo en una sucursal activa. */
export async function getBookableServices(db: DbOrTx, businessId: string) {
  const rows = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.businessId, businessId),
        eq(services.isActive, true),
        eq(services.isOnline, true),
        exists(
          db
            .select({ one: professionalServices.serviceId })
            .from(professionalServices)
            .innerJoin(professionals, eq(professionals.id, professionalServices.professionalId))
            .innerJoin(professionalBranches, eq(professionalBranches.professionalId, professionals.id))
            .innerJoin(branches, eq(branches.id, professionalBranches.branchId))
            .where(
              and(
                eq(professionalServices.serviceId, services.id),
                eq(professionals.isActive, true),
                eq(branches.isActive, true),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(services.order), asc(services.createdAt));
  return rows.map(toPublicService);
}
