"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { markNotificationsReadAction } from "../actions";

/** Al abrir la página, las novedades quedan leídas (la campanita vuelve a cero). */
export function MarkAsRead() {
  useEffect(() => {
    void markNotificationsReadAction();
  }, []);
  return null;
}

type PermissionState = NotificationPermission | "unsupported" | "unknown";

function currentPermission(): PermissionState {
  if (typeof window === "undefined") return "unknown";
  return "Notification" in window ? Notification.permission : "unsupported";
}

const noopSubscribe = () => () => {};

/** Pide permiso para mostrar avisos del navegador cuando entra un turno (con el panel abierto). */
export function BrowserAlertsButton() {
  // El permiso sólo existe en el navegador; en el servidor se renderiza como "unknown".
  const initial = useSyncExternalStore(noopSubscribe, currentPermission, () => "unknown" as const);
  const [requested, setRequested] = useState<NotificationPermission | null>(null);
  const permission = requested ?? initial;

  if (permission === "unknown" || permission === "unsupported") return null;
  if (permission === "granted") return <p className="text-sm text-emerald-700">✓ Avisos activados en este dispositivo</p>;
  if (permission === "denied") return <p className="text-sm text-neutral-500">Los avisos están bloqueados en este navegador</p>;
  return (
    <Button variant="secondary" onClick={() => Notification.requestPermission().then(setRequested)}>
      <BellRing className="size-4" /> Avisarme en este dispositivo
    </Button>
  );
}
