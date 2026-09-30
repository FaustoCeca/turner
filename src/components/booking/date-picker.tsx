"use client";

import { ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui";
import { formatSlot, WEEKDAYS_SHORT } from "@/lib/schedule";
import type { DayAvailability } from "./types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const VISIBLE = 5;

function dayParts(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return { month: MONTHS[m - 1], day: d };
}

/** Tira de 5 días (rojo = sin turnos, verde = con turnos, gris = no atiende) + horarios del día. */
export function DateSlotPicker({
  days,
  selectedDate,
  selectedMinutes,
  onSelectDate,
  onSelectSlot,
}: {
  days: DayAvailability[];
  selectedDate: string | null;
  selectedMinutes: number | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (minutes: number) => void;
}) {
  const firstAvailable = useMemo(() => days.findIndex((d) => d.status === "available"), [days]);
  // Se monta de nuevo cuando cambian los días (otro profesional/servicio), así que alcanza con el valor inicial.
  const [start, setStart] = useState(() => {
    const selectedIdx = selectedDate ? days.findIndex((d) => d.date === selectedDate) : -1;
    const anchor = selectedIdx >= 0 ? selectedIdx : firstAvailable;
    return anchor >= VISIBLE ? Math.min(anchor, Math.max(0, days.length - VISIBLE)) : 0;
  });

  const maxStart = Math.max(0, days.length - VISIBLE);
  const visible = days.slice(start, start + VISIBLE);
  const selectedDay = days.find((d) => d.date === selectedDate);

  if (firstAvailable === -1) {
    return (
      <p className="rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
        No hay horarios disponibles por el momento. Probá con otro profesional o volvé a consultar más adelante.
      </p>
    );
  }

  const groups = selectedDay
    ? [
        { label: "Por la mañana", slots: selectedDay.slots.filter((m) => m < 12 * 60) },
        { label: "Por la tarde", slots: selectedDay.slots.filter((m) => m >= 12 * 60 && m < 20 * 60) },
        { label: "Por la noche", slots: selectedDay.slots.filter((m) => m >= 20 * 60) },
      ].filter((g) => g.slots.length)
    : [];

  const navBtn = "flex size-6 items-center justify-center rounded bg-brand-dark text-white disabled:opacity-30";

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col justify-end gap-1.5 pb-0.5">
          <button type="button" className={navBtn} disabled={start === 0} onClick={() => setStart(Math.max(0, start - VISIBLE))} aria-label="5 días antes">
            <ChevronsLeft className="size-4" />
          </button>
          <button type="button" className={navBtn} disabled={start === 0} onClick={() => setStart(start - 1)} aria-label="Día anterior">
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-5 gap-2">
          {visible.map((d, i) => {
            const { month, day } = dayParts(d.date);
            const isSelected = d.date === selectedDate;
            const clickable = d.status === "available";
            return (
              <div key={d.date} className="relative flex flex-col items-center">
                <span className="mb-1 text-sm text-neutral-700">{month}</span>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSelectDate(d.date)}
                  aria-pressed={isSelected}
                  aria-label={`${WEEKDAYS_SHORT[d.weekday]} ${day} de ${month}${clickable ? "" : ", sin turnos"}`}
                  className={cn(
                    "flex w-full flex-col items-center rounded-lg py-1.5 text-[15px] shadow-sm transition",
                    isSelected
                      ? "bg-brand text-white"
                      : d.status === "available"
                        ? "bg-available text-ink hover:brightness-95"
                        : d.status === "full"
                          ? "bg-full text-ink/40"
                          : "bg-closed text-ink/40",
                  )}
                >
                  <span>{WEEKDAYS_SHORT[d.weekday]}</span>
                  <span>{day}</span>
                </button>
                {!selectedDate && start + i === firstAvailable && (
                  <div className="absolute top-full mt-1 flex w-28 flex-col items-center text-center text-sm leading-tight text-neutral-700">
                    <ArrowUp className="size-5 animate-bob text-brand" strokeWidth={3} />
                    1er día con disponibilidad
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col justify-end gap-1.5 pb-0.5">
          <button type="button" className={navBtn} disabled={start >= maxStart} onClick={() => setStart(Math.min(maxStart, start + VISIBLE))} aria-label="5 días después">
            <ChevronsRight className="size-4" />
          </button>
          <button type="button" className={navBtn} disabled={start >= maxStart} onClick={() => setStart(start + 1)} aria-label="Día siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {!selectedDate && <div className="h-20" />}

      {groups.map((g) => (
        <div key={g.label} className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 px-2 font-bold">
            <Clock className="size-4" /> <span className="underline underline-offset-4">{g.label}</span>
          </h4>
          <div className="grid grid-cols-3 gap-3 px-2 sm:grid-cols-4">
            {g.slots.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSelectSlot(m)}
                aria-pressed={selectedMinutes === m}
                className={cn(
                  "rounded-md border py-2 text-[17px] shadow-sm transition",
                  selectedMinutes === m
                    ? "border-brand bg-brand text-white"
                    : "border-neutral-200 bg-white hover:border-brand",
                )}
              >
                {formatSlot(m)} <span className={cn("text-xs", selectedMinutes === m ? "text-white/80" : "text-neutral-500")}>hs</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
