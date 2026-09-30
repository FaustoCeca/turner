import "server-only";
import { eq } from "drizzle-orm";
import MercadoPagoConfig, { PreApproval } from "mercadopago";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { env } from "./env";

function platformClient() {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) throw new Error("MP_PLATFORM_ACCESS_TOKEN no configurado");
  return new PreApproval(new MercadoPagoConfig({ accessToken: token, options: { timeout: 10_000 } }));
}

export async function createPlatformSubscription(params: {
  businessId: string;
  payerEmail: string;
  reason: string;
  amount: number;
}): Promise<{ id: string; checkoutUrl: string }> {
  const res = await platformClient().create({
    body: {
      reason: params.reason,
      external_reference: params.businessId,
      payer_email: params.payerEmail,
      back_url: `${env.appUrl}/panel/configuracion#suscripcion`,
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: params.amount, currency_id: "ARS" },
    },
  });
  if (!res.id || !res.init_point) throw new Error("Mercado Pago no devolvió la suscripción");
  return { id: res.id, checkoutUrl: res.init_point };
}

const STATUS_MAP: Record<string, string> = {
  authorized: "active",
  pending: "pending",
  paused: "paused",
  cancelled: "cancelled",
};

/** Sincroniza el estado de una suscripción a partir de la notificación de Mercado Pago. */
export async function syncPlatformSubscription(preapprovalId: string): Promise<void> {
  const sub = await platformClient().get({ id: preapprovalId });
  if (!sub.external_reference || !sub.status) return;
  const db = await getDb();
  await db
    .update(businesses)
    .set({ subscriptionId: preapprovalId, subscriptionStatus: STATUS_MAP[sub.status] ?? sub.status })
    .where(eq(businesses.id, sub.external_reference));
}
