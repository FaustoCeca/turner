import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { businesses } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { exchangeOAuthCode } from "@/lib/mercadopago";
import { businessForAction } from "@/lib/panel";

export async function GET(req: NextRequest) {
  const back = (status: "ok" | "error") => NextResponse.redirect(`${env.appUrl}/panel/configuracion?mp=${status}#mercadopago`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("mp_oauth_state")?.value;
  jar.delete({ name: "mp_oauth_state", path: "/api/mercadopago" });
  if (!code || !state || !saved) return back("error");

  const [savedState, businessId] = saved.split(".");
  if (savedState !== state) return back("error");

  let ctx;
  try {
    ctx = await businessForAction();
  } catch {
    return back("error");
  }
  if (ctx.business.id !== businessId || ctx.role !== "owner") return back("error");

  try {
    const res = await exchangeOAuthCode(code);
    const db = await getDb();
    await db
      .update(businesses)
      .set({
        mpAccessToken: encrypt(res.access_token!),
        mpRefreshToken: res.refresh_token ? encrypt(res.refresh_token) : null,
        mpPublicKey: res.public_key ?? null,
        mpUserId: res.user_id ? String(res.user_id) : null,
        mpTokenExpiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000) : null,
        mpLiveMode: res.live_mode ?? null,
      })
      .where(eq(businesses.id, businessId));
    return back("ok");
  } catch (err) {
    console.error("[mp oauth]", err);
    return back("error");
  }
}
