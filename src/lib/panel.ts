import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { businesses, type Business } from "@/db/schema";
import { getCurrentUser, getUserBusinesses, type SessionUser } from "./auth";

export const PANEL_BUSINESS_COOKIE = "panel_business";

export type PanelContext = {
  user: SessionUser;
  business: Business;
  role: "owner" | "admin";
  businesses: { id: string; name: string; slug: string }[];
};

async function resolve(): Promise<PanelContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await getUserBusinesses(user.id);
  if (!memberships.length) return null;
  const jar = await cookies();
  const preferred = jar.get(PANEL_BUSINESS_COOKIE)?.value;
  const current = memberships.find((m) => m.id === preferred) ?? memberships[0];
  const db = await getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, current.id)).limit(1);
  if (!business) return null;
  return { user, business, role: current.role, businesses: memberships };
}

/** Para páginas del panel: redirige a login u onboarding si hace falta. */
export const requireBusiness = cache(async (): Promise<PanelContext> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/panel");
  const ctx = await resolve();
  if (!ctx) redirect("/negocio/nuevo");
  return ctx;
});

/** Para server actions y route handlers: lanza error en vez de redirigir. */
export async function businessForAction(): Promise<PanelContext> {
  const ctx = await resolve();
  if (!ctx) throw new Error("No autorizado");
  return ctx;
}

export const RESERVED_SLUGS = new Set([
  "api", "login", "registro", "recuperar", "panel", "mis-turnos", "negocio", "pago-simulado",
  "precios", "ayuda", "legal", "admin", "_next", "static", "favicon.ico", "robots.txt", "sitemap.xml",
]);

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Días enteros que faltan hasta `date` (0 si ya pasó). */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86_400_000));
}
