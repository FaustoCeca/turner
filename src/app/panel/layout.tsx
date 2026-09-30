import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { unreadCount } from "@/lib/notifications";
import { daysUntil, requireBusiness } from "@/lib/panel";
import { switchBusinessAction } from "./actions";
import { PanelNav } from "./nav";
import { NotificationsBell } from "./notifications-bell";

export const metadata: Metadata = { title: { default: "Panel", template: "%s | Panel" } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, business, businesses } = await requireBusiness();
  const trialDays = daysUntil(business.trialEndsAt);
  const unread = await unreadCount(business.id);

  return (
    <div className="min-h-dvh bg-neutral-50 lg:flex">
      <aside className="bg-brand-dark text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="flex items-start justify-between gap-2 px-4 py-4">
          <div className="min-w-0">
            {businesses.length > 1 ? (
              <form action={switchBusinessAction}>
                <select
                  name="businessId"
                  defaultValue={business.id}
                  className="w-full truncate rounded bg-white/10 px-2 py-1 text-base font-bold"
                  // El cambio de negocio se envía con el botón (sin JS también funciona).
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id} className="text-ink">
                      {b.name}
                    </option>
                  ))}
                </select>
                <button className="mt-1 text-xs text-white/60 underline">Cambiar</button>
              </form>
            ) : (
              <p className="truncate text-lg font-bold">{business.name}</p>
            )}
            <Link href={`/${business.slug}`} target="_blank" className="mt-0.5 flex items-center gap-1 text-xs text-white/70 hover:text-white">
              /{business.slug} <ExternalLink className="size-3" />
            </Link>
          </div>
          <NotificationsBell key={business.id} initialUnread={unread} />
        </div>
        <PanelNav />
        <div className="hidden border-t border-white/10 px-4 py-4 text-sm lg:mt-auto lg:block">
          <p className="truncate text-white/80">{user.firstName} {user.lastName}</p>
          <div className="mt-2 flex gap-3 text-xs text-white/60">
            <Link href="/cuenta" className="hover:text-white">Mi cuenta</Link>
            <form action={logoutAction}>
              <button className="hover:text-white">Cerrar sesión</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {business.subscriptionStatus === "trial" && (
          <div className={trialDays > 0 ? "bg-amber-50 px-4 py-2 text-center text-sm text-amber-900" : "bg-red-50 px-4 py-2 text-center text-sm text-red-800"}>
            {trialDays > 0
              ? `Estás en el período de prueba gratuito: te quedan ${trialDays} ${trialDays === 1 ? "día" : "días"}.`
              : "Tu período de prueba terminó."}{" "}
            <Link href="/panel/configuracion#suscripcion" className="font-medium underline">
              Ver planes
            </Link>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
