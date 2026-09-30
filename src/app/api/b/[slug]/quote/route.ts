import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { clients, services, type Coupon } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, findValidCoupon, getBusinessBySlug } from "@/lib/bookings";
import { paymentModeFor } from "@/lib/mercadopago";
import { priceBooking } from "@/lib/pricing";

const bodySchema = z.object({
  serviceIds: z.array(z.string()).min(1).max(10),
  couponCode: z.string().max(40).nullish(),
});

/** Presupuesto del carrito: total, descuento y seña a pagar. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const db = await getDb();
  const business = await getBusinessBySlug(db, slug);
  if (!business) return NextResponse.json({ error: "Negocio inexistente" }, { status: 404 });

  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.businessId, business.id), inArray(services.id, parsed.data.serviceIds)));
  const byId = new Map(rows.map((s) => [s.id, s]));
  const items = parsed.data.serviceIds.map((id) => byId.get(id));
  if (items.some((s) => !s)) return NextResponse.json({ error: "Servicio inexistente" }, { status: 400 });

  const user = await getCurrentUser();
  let exempt = false;
  if (user) {
    const [client] = await db
      .select({ exempt: clients.depositExempt })
      .from(clients)
      .where(and(eq(clients.businessId, business.id), eq(clients.userId, user.id)))
      .limit(1);
    exempt = client?.exempt ?? false;
  }

  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  if (parsed.data.couponCode) {
    try {
      coupon = await findValidCoupon(db, business.id, parsed.data.couponCode);
    } catch (err) {
      couponError = err instanceof BookingError ? err.message : "Código inválido";
    }
  }

  const pricing = priceBooking(
    items.map((s) => ({
      price: s!.price,
      priceTBD: s!.priceTBD,
      depositApplies: business.requireDeposit && s!.depositEnabled && !exempt,
      depositPercent: s!.depositPercent ?? business.depositPercent,
    })),
    coupon,
    business.depositMinAmount,
  );

  return NextResponse.json({
    ...pricing,
    coupon: coupon ? { code: coupon.code, discountType: coupon.discountType, value: coupon.value } : null,
    couponError,
    paymentMode: pricing.deposit > 0 ? paymentModeFor(business) : null,
  });
}
