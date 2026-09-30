"use client";

import { useState, type ReactNode } from "react";
import { WEEKDAYS_SHORT } from "@/lib/schedule";
import { Alert, cn } from "./ui";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-neutral-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormMessage({ state }: { state: { error?: string; message?: string; ok?: boolean } }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok && state.message) return <Alert tone="green">{state.message}</Alert>;
  return null;
}

/** Selector de días de la semana como chips; envía `name` una vez por día elegido. */
export function WeekdayPicker({ name, defaultValue, disabled }: { name: string; defaultValue: number[]; disabled?: boolean }) {
  const [days, setDays] = useState(new Set(defaultValue));
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS_SHORT.map((label, d) => {
        const on = days.has(d);
        return (
          <label
            key={d}
            className={cn(
              "cursor-pointer select-none rounded-md border px-2 py-1 text-xs capitalize transition",
              on ? "border-brand bg-brand text-white" : "border-neutral-300 text-neutral-500",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={d}
              checked={on}
              disabled={disabled}
              onChange={() => {
                const next = new Set(days);
                if (on) next.delete(d);
                else next.add(d);
                setDays(next);
              }}
              className="sr-only"
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}
