"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { env } from "@/lib/env";
import { businessForAction } from "@/lib/panel";
import { PLANS } from "@/lib/plans";
import { createPlatformSubscription } from "@/lib/subscriptions";
import type { ActionState } from "../actions";

/** Suscripción mensual a la plataforma con Mercado Pago (débito automático / preapproval). */
export async function subscribeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { business, user, role } = await businessForAction();
  if (role !== "owner") return { error: "Sólo el dueño puede gestionar la suscripción" };
  const plan = PLANS.find((p) => p.id === fd.get("plan"));
  const professionals = Math.min(100, Math.max(1, Math.round(Number(fd.get("professionals")) || 1)));
  if (!plan) return { error: "Elegí un plan" };
  const amount = plan.pricePerProfessional * professionals;
  const db = await getDb();

  if (!process.env.MP_PLATFORM_ACCESS_TOKEN) {
    if (!env.mp.mockEnabled) return { error: "Las suscripciones todavía no están habilitadas." };
    await db.update(businesses).set({ plan: plan.id, subscriptionStatus: "active" }).where(eq(businesses.id, business.id));
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Suscripción simulada activada (modo desarrollo)." };
  }

  let checkoutUrl: string;
  try {
    const sub = await createPlatformSubscription({
      businessId: business.id,
      payerEmail: user.email,
      reason: `${env.appName} - Plan ${plan.name} (${professionals} prof.)`,
      amount,
    });
    await db
      .update(businesses)
      .set({ plan: plan.id, subscriptionId: sub.id, subscriptionStatus: "pending" })
      .where(eq(businesses.id, business.id));
    checkoutUrl = sub.checkoutUrl;
  } catch (err) {
    console.error("[subscription]", err);
    return { error: "No pudimos iniciar la suscripción con Mercado Pago." };
  }
  redirect(checkoutUrl);
}
