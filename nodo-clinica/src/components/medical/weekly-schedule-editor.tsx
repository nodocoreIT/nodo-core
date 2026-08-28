"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dayLabel, type DaySchedule } from "@/lib/clinic/schedule";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

function sortDays(days: DaySchedule[]): DaySchedule[] {
  return [...days].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
  );
}

interface WeeklyScheduleEditorProps {
  days: DaySchedule[];
  onChange: (days: DaySchedule[]) => void;
  showCopyMondayToWeekdays?: boolean;
}

/** Day/time-block grid shared by the main "Días que atiendo" (virtual) agenda
 * and "Turnos Presenciales" — same checkbox-per-day + multi-franja editor,
 * so both screens look and behave identically instead of drifting apart. */
export function WeeklyScheduleEditor({
  days,
  onChange,
  showCopyMondayToWeekdays = true,
}: WeeklyScheduleEditorProps) {
  const toggleDay = (dayOfWeek: number) => {
    const exists = days.some((d) => d.dayOfWeek === dayOfWeek);
    if (exists) {
      onChange(days.filter((d) => d.dayOfWeek !== dayOfWeek));
    } else {
      onChange(sortDays([...days, { dayOfWeek, startTime: "09:00", endTime: "13:00" }]));
    }
  };

  const blocksForDay = (dayOfWeek: number) => days.filter((d) => d.dayOfWeek === dayOfWeek);

  const updateBlockTime = (
    dayOfWeek: number,
    blockIndex: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    let idx = -1;
    onChange(
      days.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        idx += 1;
        if (idx !== blockIndex) return d;
        return { ...d, [field]: value };
      }),
    );
  };

  const addBlockForDay = (dayOfWeek: number) => {
    onChange(sortDays([...days, { dayOfWeek, startTime: "16:00", endTime: "19:00" }]));
  };

  const removeBlockForDay = (dayOfWeek: number, blockIndex: number) => {
    let idx = -1;
    onChange(
      days.filter((d) => {
        if (d.dayOfWeek !== dayOfWeek) return true;
        idx += 1;
        return idx !== blockIndex;
      }),
    );
  };

  const copyMondayToWeekdays = () => {
    const monday = days.filter((d) => d.dayOfWeek === 1);
    if (!monday.length) return;
    const rest = days.filter((d) => ![2, 3, 4, 5].includes(d.dayOfWeek));
    const copied = [2, 3, 4, 5].flatMap((dayOfWeek) =>
      monday.map((b) => ({ ...b, dayOfWeek })),
    );
    onChange(sortDays([...rest, ...copied]));
  };

  return (
    <div className="space-y-2">
      {showCopyMondayToWeekdays && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
            disabled={blocksForDay(1).length === 0}
            onClick={copyMondayToWeekdays}
          >
            Copiar Lun a Vie
          </Button>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {ALL_DAYS.map((dow) => {
          const active = days.some((d) => d.dayOfWeek === dow);
          const blocks = blocksForDay(dow);
          return (
            <div
              key={dow}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 ${
                active ? "bg-blue-50/30" : ""
              }`}
            >
              <label className="flex items-center gap-2 w-14 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleDay(dow)}
                  className="rounded"
                />
                <span className="text-sm font-medium">{dayLabel(dow)}</span>
              </label>
              {active ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {blocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="flex items-center gap-1">
                      <Input
                        type="time"
                        value={block.startTime}
                        onChange={(e) =>
                          updateBlockTime(dow, blockIndex, "startTime", e.target.value)
                        }
                        className="h-7 w-26 text-xs px-1.5"
                      />
                      <span className="text-xs text-slate-400">a</span>
                      <Input
                        type="time"
                        value={block.endTime}
                        onChange={(e) =>
                          updateBlockTime(dow, blockIndex, "endTime", e.target.value)
                        }
                        className="h-7 w-26 text-xs px-1.5"
                      />
                      {blocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlockForDay(dow, blockIndex)}
                          className="text-red-500 hover:text-red-700 text-xs px-1"
                          aria-label="Quitar franja"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBlockForDay(dow)}
                    className="text-xs text-blue-600 hover:text-blue-700 px-1"
                  >
                    + franja
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">No atiende</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
