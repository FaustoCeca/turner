"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { branches, businessMembers, businesses, professionalBranches, professionals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isValidSlug, PANEL_BUSINESS_COOKIE, slugify } from "@/lib/panel";
import { defaultSchedule } from "@/lib/schedule";

export type OnboardingState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio").max(80),
  slug: z.string().trim().toLowerCase(),
  category: z.string().trim().max(60).optional(),
  address: z.string().trim().min(3, "Ingresá la dirección").max(160),
  city: z.string().trim().max(80).optional(),
  whatsapp: z.string().trim().max(30).optional(),
});

export async function createBusinessAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/negocio/nuevo");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!isValidSlug(slug)) return { error: "La dirección web no es válida o está reservada. Probá con otra." };

  const db = await getDb();
  const [taken] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (taken) return { error: `La dirección /${slug} ya está en uso. Elegí otra.` };

  const businessId = await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({
        name: data.name,
        slug,
        category: data.category || null,
        ownerId: user.id,
        whatsapp: data.whatsapp || null,
      })
      .returning();
    await tx.insert(businessMembers).values({ businessId: business.id, userId: user.id, role: "owner" });
    const [branch] = await tx
      .insert(branches)
      .values({ businessId: business.id, address: data.address, city: data.city || null })
      .returning();
    // El dueño arranca como primer profesional, con horario de lunes a viernes 9 a 18.
    const [pro] = await tx
      .insert(professionals)
      .values({ businessId: business.id, userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email })
      .returning();
    await tx.insert(professionalBranches).values({ professionalId: pro.id, branchId: branch.id, schedule: defaultSchedule() });
    return business.id;
  });

  (await cookies()).set(PANEL_BUSINESS_COOKIE, businessId, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/panel/servicios/nuevo?primero=1");
}
