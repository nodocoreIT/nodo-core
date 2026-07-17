"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarDay = {
  date: string;
  label: string;
  status: "available" | "full" | "closed";
};

interface MonthCalendarProps {
  days: CalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function parseKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function MonthCalendar({ days, selectedDate, onSelectDate }: MonthCalendarProps) {
  const dayByKey = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const firstDay = days[0] ? parseKeyToLocalDate(days[0].date) : new Date();
  const lastDay = days[days.length - 1]
    ? parseKeyToLocalDate(days[days.length - 1].date)
    : new Date();

  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(
      days.find((d) => d.status === "available")
        ? parseKeyToLocalDate(days.find((d) => d.status === "available")!.date)
        : firstDay,
    ),
  );

  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const canGoPrev = startOfMonth(monthCursor) > startOfMonth(firstDay);
  const canGoNext = startOfMonth(monthCursor) < startOfMonth(lastDay);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canGoPrev}
          onClick={() => setMonthCursor((m) => subMonths(m, 1))}
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
          disabled={!canGoNext}
          onClick={() => setMonthCursor((m) => addMonths(m, 1))}
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
            "h-8 flex items-center justify-center rounded-md text-xs";

          if (!inMonth) {
            return <div key={key} className={`${base} text-transparent`} />;
          }

          if (info?.status === "available") {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(key)}
                className={`${base} border cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {day.getDate()}
              </button>
            );
          }

          if (info?.status === "full") {
            return (
              <div
                key={key}
                title="Turnos completos"
                className={`${base} bg-red-50 text-red-400 line-through cursor-not-allowed`}
              >
                {day.getDate()}
              </div>
            );
          }

          return (
            <div
              key={key}
              className={`${base} text-slate-300 cursor-not-allowed`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-300" />
          Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100 border border-red-300" />
          Completo
        </span>
      </div>
    </div>
  );
}
