import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getAuthorizationUrl } from "@/lib/mercadopago";
import { businessForAction } from "@/lib/panel";

/** Inicia el OAuth para que el negocio vincule su cuenta de Mercado Pago. */
export async function GET() {
  let ctx;
  try {
    ctx = await businessForAction();
  } catch {
    return NextResponse.redirect(`${env.appUrl}/login?next=/panel/configuracion`);
  }
  if (ctx.role !== "owner" || !env.mp.oauthEnabled) {
    return NextResponse.redirect(`${env.appUrl}/panel/configuracion?mp=error#mercadopago`);
  }
  const state = randomToken(16);
  (await cookies()).set("mp_oauth_state", `${state}.${ctx.business.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/mercadopago",
    maxAge: 600,
  });
  return NextResponse.redirect(getAuthorizationUrl(state));
}
