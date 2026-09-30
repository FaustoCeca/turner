import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/panel-ui";
import { cn } from "@/lib/cn";
import { latestNotifications } from "@/lib/notifications";
import { requireBusiness } from "@/lib/panel";
import { formatInTz } from "@/lib/time";
import { BrowserAlertsButton, MarkAsRead } from "./client";

export const metadata: Metadata = { title: "Novedades" };

const ICONS: Record<string, string> = { booking: "🗓️", cancellation: "❌", reschedule: "🔁", refund: "💸" };

export default async function NotificationsPage() {
  const { business } = await requireBusiness();
  const items = await latestNotifications(business.id, 100);
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <>
      <PageHeader
        title="Novedades"
        description="Reservas nuevas y cambios que hacen tus clientes."
        actions={<BrowserAlertsButton />}
      />
      {hasUnread && <MarkAsRead />}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-600">
          Todavía no hay novedades. Cuando alguien reserve, cancele o cambie un turno lo vas a ver acá.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href ?? "/panel"}
                className={cn(
                  "flex gap-3 rounded-xl border bg-white p-4 transition hover:border-brand",
                  n.readAt ? "border-neutral-200" : "border-brand/40 bg-brand/5",
                )}
              >
                <span className="text-xl" aria-hidden>
                  {ICONS[n.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold">{n.title}</span>
                    <span className="text-xs text-neutral-500">{formatInTz(n.createdAt, business.timezone, "d/MM HH:mm")}</span>
                  </span>
                  <span className="mt-1 block whitespace-pre-line text-sm text-neutral-700">{n.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
