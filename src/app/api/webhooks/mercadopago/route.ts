import { eq } from "drizzle-orm";
import { WebhookSignatureValidator } from "mercadopago";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { bookings, businesses } from "@/db/schema";
import { applyPaymentUpdate } from "@/lib/bookings";
import { env } from "@/lib/env";
import { fetchPayment, getSellerToken } from "@/lib/mercadopago";
import { syncPlatformSubscription } from "@/lib/subscriptions";

/**
 * Notificaciones de Mercado Pago. Nunca confiamos en el cuerpo: con el id recibido
 * consultamos el pago/suscripción a la API de Mercado Pago y actuamos sobre esa respuesta.
 */
export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; action?: string; data?: { id?: string | number } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!dataId) return NextResponse.json({ ok: true });

  let signatureValid = false;
  if (env.mp.webhookSecret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId: url.searchParams.get("data.id") ?? dataId,
        secret: env.mp.webhookSecret,
      });
      signatureValid = true;
    } catch (err) {
      console.warn("[webhook] firma no válida", (err as Error).message);
    }
  }
  // Las notificaciones de nuestra aplicación (OAuth y suscripciones) deben venir firmadas.
  // Los negocios que pegaron su propio Access Token reciben notificaciones firmadas con el secreto
  // de SU aplicación: se aceptan porque el pago se vuelve a consultar y aplicarlo es idempotente.
  const rejectUnsigned = (oauthBusiness: boolean) => env.mp.webhookSecret && !signatureValid && oauthBusiness;

  try {
    if (type === "payment") {
      const businessId = url.searchParams.get("b");
      if (!businessId) return NextResponse.json({ ok: true });
      const db = await getDb();
      const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!business) return NextResponse.json({ ok: true });
      if (rejectUnsigned(Boolean(business.mpRefreshToken))) return NextResponse.json({ error: "firma inválida" }, { status: 401 });
      const token = await getSellerToken(db, business);
      if (!token) return NextResponse.json({ ok: true });

      const payment = await fetchPayment(token, dataId);
      if (!payment.externalReference) return NextResponse.json({ ok: true });
      const [booking] = await db
        .select({ id: bookings.id, businessId: bookings.businessId })
        .from(bookings)
        .where(eq(bookings.id, payment.externalReference))
        .limit(1);
      if (!booking || booking.businessId !== business.id) return NextResponse.json({ ok: true });

      await applyPaymentUpdate(booking.id, {
        provider: "mercadopago",
        id: payment.id,
        status: payment.status,
        statusDetail: payment.statusDetail,
        amount: payment.amount,
        refunded: payment.refunded,
        expiresAt: payment.expiresAt,
        raw: payment.raw,
      });
    } else if (type === "subscription_preapproval" || type === "preapproval") {
      if (rejectUnsigned(true)) return NextResponse.json({ error: "firma inválida" }, { status: 401 });
      await syncPlatformSubscription(dataId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] error procesando", type, dataId, err);
    // 500 → Mercado Pago reintenta la notificación más tarde.
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
