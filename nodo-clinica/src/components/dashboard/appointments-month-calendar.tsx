"use client";

import { useMemo } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AppointmentCalendarDay = {
  date: string; // "yyyy-MM-dd"
  count: number;
  patientCount: number;
};

interface AppointmentsMonthCalendarProps {
  monthKey: string; // "yyyy-MM"
  days: AppointmentCalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange: (monthKey: string) => void;
  loading?: boolean;
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function toMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function AppointmentsMonthCalendar({
  monthKey,
  days,
  selectedDate,
  onSelectDate,
  onMonthChange,
  loading = false,
}: AppointmentsMonthCalendarProps) {
  const monthCursor = parseMonthKey(monthKey);

  const dayByKey = useMemo(() => {
    const map = new Map<string, AppointmentCalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={loading}
          onClick={() => onMonthChange(toMonthKey(subMonths(monthCursor, 1)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium text-slate-700 capitalize">
          {format(monthCursor, "MMMM yyyy", { locale: es })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={loading}
          onClick={() => onMonthChange(toMonthKey(addMonths(monthCursor, 1)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthCursor);
          const info = dayByKey.get(key);
          const isSelected = selectedDate === key;
          const base =
            "h-10 flex flex-col items-center justify-center rounded-md text-xs relative";

          if (!inMonth) {
            return <div key={key} className={`${base} text-transparent`} />;
          }

          const hasAppointments = (info?.count ?? 0) > 0;

          if (hasAppointments) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={`${base} border cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-brand text-white border-brand"
                    : "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20"
                }`}
              >
                <span className={isToday(day) ? "font-bold underline" : ""}>
                  {day.getDate()}
                </span>
                <span className="text-[9px] leading-none mt-0.5">{info!.count}</span>
              </button>
            );
          }

          return (
            <div
              key={key}
              className={`${base} text-slate-300 ${isToday(day) ? "font-bold underline" : ""}`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-500">
        <span className="h-2.5 w-2.5 rounded-sm bg-brand/10 border border-brand/30" />
        Días con turnos — el número es la cantidad de turnos ese día.
      </div>
    </div>
  );
}
