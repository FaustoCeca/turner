"use client";

import { Check, MessageCircle } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { markReminderSentAction } from "../actions";

export type ReminderRow = {
  id: string;
  time: string;
  client: string;
  phone: string | null;
  service: string;
  professional: string;
  whatsappUrl: string | null;
  sentAt: string | null;
};

export function RemindersList({ rows }: { rows: ReminderRow[] }) {
  const [, startTransition] = useTransition();
  const [sent, markSent] = useOptimistic(
    new Set(rows.filter((r) => r.sentAt).map((r) => r.id)),
    (current: Set<string>, id: string) => new Set(current).add(id),
  );

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-600">
        No hay turnos confirmados para este día.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="w-14 font-bold tabular-nums">{r.time}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{r.client}</span>
            <span className="block text-sm text-neutral-600">
              {r.service} · {r.professional}
            </span>
          </span>
          {r.whatsappUrl ? (
            <a
              href={r.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                startTransition(async () => {
                  markSent(r.id);
                  await markReminderSentAction(r.id);
                })
              }
              className={
                sent.has(r.id)
                  ? "inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  : "inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-3 py-2 text-sm font-medium text-white"
              }
            >
              {sent.has(r.id) ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
              {sent.has(r.id) ? `Enviado${r.sentAt ? ` ${r.sentAt}` : ""} · reenviar` : "Recordar por WhatsApp"}
            </a>
          ) : (
            <span className="text-sm text-neutral-500">Sin teléfono cargado</span>
          )}
        </li>
      ))}
    </ul>
  );
}
