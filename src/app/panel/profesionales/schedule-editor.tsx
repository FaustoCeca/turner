"use client";

import { Copy, Plus, X } from "lucide-react";
import { Checkbox, cn, Select } from "@/components/ui";
import { defaultSchedule, minutesToHHMM, WEEKDAYS, type WeekSchedule } from "@/lib/schedule";

const TIMES = Array.from({ length: 97 }, (_, i) => i * 15); // 00:00 … 24:00

export type BranchScheduleState = Record<string, WeekSchedule>;

/** Editor del horario semanal de un profesional en cada sucursal. */
export function ScheduleEditor({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; label: string }[];
  value: BranchScheduleState;
  onChange: (next: BranchScheduleState) => void;
}) {
  function setBranch(branchId: string, schedule: WeekSchedule | null) {
    const next = { ...value };
    if (schedule) next[branchId] = schedule;
    else delete next[branchId];
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="schedules" value={JSON.stringify(value)} />
      {branches.map((b) => {
        const schedule = value[b.id];
        return (
          <div key={b.id} className="rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
              <Checkbox
                checked={Boolean(schedule)}
                onChange={(e) => setBranch(b.id, e.target.checked ? defaultSchedule() : null)}
                label={<span className="font-medium">Atiende en {b.label}</span>}
              />
              {schedule && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-neutral-600 underline"
                  onClick={() => setBranch(b.id, schedule.map(() => structuredClone(schedule[0])))}
                >
                  <Copy className="size-3" /> Copiar lunes a todos
                </button>
              )}
            </div>
            {schedule && (
              <div className="divide-y divide-neutral-100">
                {schedule.map((day, d) => (
                  <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Checkbox
                      className="w-28"
                      checked={day.enabled}
                      onChange={(e) => {
                        const next = structuredClone(schedule);
                        next[d].enabled = e.target.checked;
                        if (e.target.checked && !next[d].ranges.length) next[d].ranges = [{ start: 540, end: 1080 }];
                        setBranch(b.id, next);
                      }}
                      label={WEEKDAYS[d]}
                    />
                    <div className={cn("flex flex-1 flex-wrap items-center gap-2", !day.enabled && "opacity-40")}>
                      {day.enabled &&
                        day.ranges.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-sm">
                            <TimeSelect
                              value={r.start}
                              onChange={(v) => {
                                const next = structuredClone(schedule);
                                next[d].ranges[i].start = v;
                                setBranch(b.id, next);
                              }}
                            />
                            a
                            <TimeSelect
                              value={r.end}
                              onChange={(v) => {
                                const next = structuredClone(schedule);
                                next[d].ranges[i].end = v;
                                setBranch(b.id, next);
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Quitar franja"
                              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                              onClick={() => {
                                const next = structuredClone(schedule);
                                next[d].ranges.splice(i, 1);
                                if (!next[d].ranges.length) next[d].enabled = false;
                                setBranch(b.id, next);
                              }}
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ))}
                      {day.enabled && (
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-brand"
                          onClick={() => {
                            const next = structuredClone(schedule);
                            const last = next[d].ranges.at(-1);
                            const start = last ? Math.min(last.end + 60, 1380) : 540;
                            next[d].ranges.push({ start, end: Math.min(start + 240, 1440) });
                            setBranch(b.id, next);
                          }}
                        >
                          <Plus className="size-3" /> Franja
                        </button>
                      )}
                      {!day.enabled && <span className="text-sm text-neutral-500">No atiende</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-auto py-1">
      {TIMES.map((t) => (
        <option key={t} value={t}>
          {minutesToHHMM(t)}
        </option>
      ))}
    </Select>
  );
}
