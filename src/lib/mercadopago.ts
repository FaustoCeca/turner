import "server-only";
import { eq } from "drizzle-orm";
import MercadoPagoConfig, { OAuth, Payment, PaymentRefund, Preference } from "mercadopago";
import type { DbOrTx } from "@/db";
import { businesses, type Business } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";
import { env } from "./env";

export type PaymentMode = "mercadopago" | "mock";

/** Cómo cobra la seña este negocio, o null si no puede cobrar. */
export function paymentModeFor(business: Pick<Business, "mpAccessToken">): PaymentMode | null {
  if (business.mpAccessToken) return "mercadopago";
  if (env.mp.mockEnabled) return "mock";
  return null;
}

function client(accessToken: string) {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

/** Access token del vendedor, refrescándolo si está por vencer (duran 180 días). */
export async function getSellerToken(
  db: DbOrTx,
  business: Pick<Business, "id" | "mpAccessToken" | "mpRefreshToken" | "mpTokenExpiresAt">,
): Promise<string | null> {
  if (!business.mpAccessToken) return null;
  const token = decrypt(business.mpAccessToken);
  const expiresSoon =
    business.mpTokenExpiresAt && business.mpTokenExpiresAt.getTime() - Date.now() < 7 * 86_400_000;
  if (!expiresSoon || !business.mpRefreshToken || !env.mp.oauthEnabled) return token;

  try {
    const res = await new OAuth(client(token)).refresh({
      body: {
        client_id: env.mp.clientId,
        client_secret: env.mp.clientSecret,
        refresh_token: decrypt(business.mpRefreshToken),
      },
    });
    if (!res.access_token) return token;
    await db
      .update(businesses)
      .set({
        mpAccessToken: encrypt(res.access_token),
        mpRefreshToken: res.refresh_token ? encrypt(res.refresh_token) : business.mpRefreshToken,
        mpTokenExpiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000) : null,
      })
      .where(eq(businesses.id, business.id));
    return res.access_token;
  } catch (err) {
    console.error("[mp] no se pudo refrescar el token", err);
    return token;
  }
}

export async function createDepositPreference(
  accessToken: string,
  params: {
    bookingId: string;
    businessId: string;
    businessName: string;
    slug: string;
    title: string;
    amount: number;
    currency: string;
    payer: { email: string; firstName: string; lastName: string };
    expiresAt: Date;
  },
): Promise<{ id: string; checkoutUrl: string }> {
  const returnUrl = `${env.appUrl}/${params.slug}/reserva/${params.bookingId}`;
  const https = env.appUrl.startsWith("https://");
  const pref = await new Preference(client(accessToken)).create({
    body: {
      items: [
        {
          id: params.bookingId,
          title: params.title,
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ],
      payer: { email: params.payer.email, name: params.payer.firstName, surname: params.payer.lastName },
      external_reference: params.bookingId,
      back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
      // Mercado Pago rechaza auto_return y notification_url con URLs no públicas (localhost).
      ...(https
        ? {
            auto_return: "approved",
            notification_url: `${env.appUrl}/api/webhooks/mercadopago?b=${params.businessId}`,
          }
        : {}),
      statement_descriptor: params.businessName.slice(0, 22),
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: params.expiresAt.toISOString(),
      payment_methods: { installments: 1 },
      metadata: { booking_id: params.bookingId },
    },
    requestOptions: { idempotencyKey: `pref-${params.bookingId}` },
  });
  const url = accessToken.startsWith("TEST-") ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point;
  if (!pref.id || !url) throw new Error("Mercado Pago no devolvió la preferencia");
  return { id: pref.id, checkoutUrl: url };
}

export type MpPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  amount: number;
  refunded: number;
  expiresAt: Date | null;
  raw: unknown;
};

export async function fetchPayment(accessToken: string, paymentId: string): Promise<MpPayment> {
  const p = await new Payment(client(accessToken)).get({ id: paymentId });
  return {
    id: String(p.id),
    status: p.status ?? "unknown",
    statusDetail: p.status_detail ?? null,
    externalReference: p.external_reference ?? null,
    amount: Math.round(p.transaction_amount ?? 0),
    refunded: Math.round(p.transaction_amount_refunded ?? 0),
    expiresAt: p.date_of_expiration ? new Date(p.date_of_expiration) : null,
    raw: p,
  };
}

/** Busca el último pago de una reserva por external_reference (útil si no llegó el webhook). */
export async function findPaymentByReference(accessToken: string, bookingId: string): Promise<MpPayment | null> {
  const res = await new Payment(client(accessToken)).search({
    options: { external_reference: bookingId, sort: "date_created", criteria: "desc", limit: 1 },
  });
  const p = res.results?.[0];
  if (!p?.id) return null;
  return fetchPayment(accessToken, String(p.id));
}

/** `idempotencyKey` debe ser estable para la misma devolución, así un reintento no devuelve dos veces. */
export async function refundPayment(accessToken: string, paymentId: string, amount: number | undefined, idempotencyKey: string) {
  return new PaymentRefund(client(accessToken)).create({
    payment_id: paymentId,
    body: amount ? { amount } : {},
    requestOptions: { idempotencyKey },
  });
}

/* ───────────── OAuth: cada negocio conecta su propia cuenta ───────────── */

export function oauthRedirectUri(): string {
  return `${env.appUrl}/api/mercadopago/callback`;
}

export function getAuthorizationUrl(state: string): string {
  return new OAuth(client("unused")).getAuthorizationURL({
    options: { client_id: env.mp.clientId, redirect_uri: oauthRedirectUri(), state },
  });
}

export async function exchangeOAuthCode(code: string) {
  const res = await new OAuth(client("unused")).create({
    body: {
      client_id: env.mp.clientId,
      client_secret: env.mp.clientSecret,
      code,
      redirect_uri: oauthRedirectUri(),
    },
  });
  if (!res.access_token) throw new Error("Mercado Pago no devolvió el access token");
  return res;
}
