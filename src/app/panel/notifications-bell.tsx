"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

/**
 * Campanita de novedades. Mientras el panel está abierto consulta cada minuto; si llegó algo nuevo
 * refresca la página (la agenda muestra el turno) y, si el dueño lo permitió, muestra un aviso del navegador.
 */
export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/panel/novedades", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data: { unread: number; latest: { id: string; title: string; body: string } | null } = await res.json();
        const isNew = data.latest && lastId.current !== null && data.latest.id !== lastId.current;
        if (data.latest) lastId.current = data.latest.id;
        else lastId.current ??= "";
        setUnread(data.unread);
        if (isNew && data.latest) {
          router.refresh();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(data.latest.title, { body: data.latest.body, tag: data.latest.id });
          }
        }
      } catch {
        // sin conexión: se reintenta en el próximo ciclo
      }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router]);

  return (
    <Link
      href="/panel/novedades"
      className="relative inline-flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
      aria-label={unread ? `Novedades: ${unread} sin leer` : "Novedades"}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
