"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Hourglass,
  Users,
  ListTodo,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { buildGoogleCalendarDayEmbed } from "@/lib/google-calendar";
import { mapAppointmentStatusToLifecycle } from "@/types";
import type { PatientLifecycleStatus } from "@/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDaysToDateKey, parseLocalDate } from "@/lib/clinic/schedule";
import type { AppointmentRow, TodayTask } from "@/hooks/use-medico-home-agenda";

const STATUS_LABELS: Record<PatientLifecycleStatus, string> = {
  en_espera: "En espera",
  en_consulta: "En consulta",
  finalizada: "Finalizada",
};

const STATUS_STYLES: Record<PatientLifecycleStatus, string> = {
  en_espera: "bg-amber-50 text-amber-800 border-amber-200",
  en_consulta: "bg-brand/10 text-brand border-brand/30",
  finalizada: "bg-mist text-slate2 border-mist",
};

function PatientRow({
  apt,
  showDate = false,
}: {
  apt: AppointmentRow;
  showDate?: boolean;
}) {
  const lifecycle = mapAppointmentStatusToLifecycle(
    apt.status as "scheduled" | "waiting" | "in_consultation" | "completed" | "cancelled",
  );
  const when = new Date(apt.scheduledAt);
  const time = format(when, "HH:mm", { locale: es });
  const dateLabel = format(when, "EEE d MMM", { locale: es });

  return (
    <Link
      href="/medico/consultorio"
      className="flex items-center gap-2.5 rounded-md border border-mist bg-white px-2.5 py-2 hover:border-brand/40 hover:shadow-sm transition-all"
    >
      <UserAvatar
        name={apt.patient?.fullName ?? "Paciente"}
        photoUrl={apt.patient?.profilePhotoData}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-navy truncate">
          {apt.patient?.fullName ?? "Paciente"}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-slate2 mt-0.5">
          <Clock className="h-3 w-3 shrink-0" />
          {showDate ? `${dateLabel} · ${time}` : time}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn("text-[9px] shrink-0 px-1.5 py-0", STATUS_STYLES[lifecycle])}
      >
        {STATUS_LABELS[lifecycle]}
      </Badge>
    </Link>
  );
}

interface MedicoHomeAgendaSidebarProps {
  loading: boolean;
  dayAppts: AppointmentRow[];
  upcomingAppts: AppointmentRow[];
  selectedBlocks: { startTime: string; endTime: string }[];
  stats: { waiting: number; inConsult: number; done: number };
  selectedDateKey: string;
  selectedDateLabel: string;
  onSelectDate: (dateKey: string) => void;
  onSelectToday: () => void;
  onSelectTomorrow: () => void;
  todayKey: string;
  tomorrowKey: string;
}

export function MedicoHomeAgendaSidebar({
  loading,
  dayAppts,
  upcomingAppts,
  selectedBlocks,
  stats,
  selectedDateKey,
  selectedDateLabel,
  onSelectDate,
  onSelectToday,
  onSelectTomorrow,
  todayKey,
  tomorrowKey,
}: MedicoHomeAgendaSidebarProps) {
  if (loading) {
    return (
      <aside className="rounded-md border border-border bg-card p-6 text-center text-sm text-slate2">
        Cargando agenda…
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
        <div className="rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2.5 flex lg:flex-row flex-col items-center lg:justify-between gap-1 text-center lg:text-left">
          <div className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-[10px] font-semibold uppercase text-slate2 hidden lg:inline">
              En espera
            </span>
          </div>
          <p className="text-xl font-bold text-navy leading-none">{stats.waiting}</p>
          <span className="text-[10px] font-semibold uppercase text-slate2 lg:hidden">
            En espera
          </span>
        </div>
        <div className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2.5 flex lg:flex-row flex-col items-center lg:justify-between gap-1 text-center lg:text-left">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand shrink-0" />
            <span className="text-[10px] font-semibold uppercase text-slate2 hidden lg:inline">
              En consulta
            </span>
          </div>
          <p className="text-xl font-bold text-navy leading-none">{stats.inConsult}</p>
          <span className="text-[10px] font-semibold uppercase text-slate2 lg:hidden">
            En consulta
          </span>
        </div>
        <div className="rounded-md border border-mist bg-white px-3 py-2.5 flex lg:flex-row flex-col items-center lg:justify-between gap-1 text-center lg:text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-slate2 shrink-0" />
            <span className="text-[10px] font-semibold uppercase text-slate2 hidden lg:inline">
              Finalizados
            </span>
          </div>
          <p className="text-xl font-bold text-navy leading-none">{stats.done}</p>
          <span className="text-[10px] font-semibold uppercase text-slate2 lg:hidden">
            Finalizados
          </span>
        </div>
      </div>

      {/* Pacientes del día */}
      <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden flex-1">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-[#EEF3F8]">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate2">
                Pacientes del día
              </p>
              <h3 className="font-display font-bold text-navy text-xs capitalize truncate">
                {selectedDateLabel}
              </h3>
            </div>
          </div>
          <Link
            href="/medico/consultorio"
            className="text-[10px] font-semibold text-brand hover:underline shrink-0"
          >
            Consultorio
          </Link>
        </div>
        <div className="px-2 pt-2 flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={selectedDateKey === todayKey ? "default" : "outline"}
            className="h-7 text-[10px] px-2"
            onClick={onSelectToday}
          >
            Hoy
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedDateKey === tomorrowKey ? "default" : "outline"}
            className="h-7 text-[10px] px-2"
            onClick={onSelectTomorrow}
          >
            Mañana
          </Button>
          <Input
            type="date"
            value={selectedDateKey}
            onChange={(e) => {
              if (e.target.value) onSelectDate(e.target.value);
            }}
            className="h-7 w-[9.5rem] text-[10px] px-2"
          />
        </div>
        <div className="p-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {selectedBlocks.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              No tenés franja de atención este día.
            </p>
          ) : dayAppts.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              Sin turnos reservados para este día.
              <span className="block mt-1 text-[10px]">
                Atención:{" "}
                {selectedBlocks.map((b) => `${b.startTime}–${b.endTime}`).join(" · ")}
              </span>
            </p>
          ) : (
            dayAppts.map((apt) => <PatientRow key={apt.id} apt={apt} />)
          )}
        </div>
      </section>

      {/* Próximos turnos */}
      <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-[#EEF3F8]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-navy shrink-0" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate2">
                Próximos turnos
              </p>
              <h3 className="font-display font-bold text-navy text-xs">
                Programados
              </h3>
            </div>
          </div>
        </div>
        <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
          {upcomingAppts.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              No hay turnos programados a futuro.
            </p>
          ) : (
            upcomingAppts.map((apt) => (
              <PatientRow key={apt.id} apt={apt} showDate />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

interface MedicoHomeTasksProps {
  loading: boolean;
  dayTasks: TodayTask[];
  calendarSrc: string | null;
  selectedDateKey: string;
  selectedDateLabel: string;
  onSelectDate: (dateKey: string) => void;
  onSelectToday: () => void;
  onSelectTomorrow: () => void;
  todayKey: string;
  tomorrowKey: string;
}

export function MedicoHomeTasks({
  loading,
  dayTasks,
  calendarSrc,
  selectedDateKey,
  selectedDateLabel,
  onSelectDate,
  onSelectToday,
  onSelectTomorrow,
  todayKey,
  tomorrowKey,
}: MedicoHomeTasksProps) {
  const selectedDate = parseLocalDate(selectedDateKey);
  const todayCalendarUrl = calendarSrc
    ? buildGoogleCalendarDayEmbed(calendarSrc, selectedDate)
    : null;

  const shiftDate = (delta: number) => {
    onSelectDate(addDaysToDateKey(selectedDateKey, delta));
  };

  if (loading) {
    return (
      <section className="rounded-md border border-border bg-card p-8 text-center text-sm text-slate2 min-h-[300px] flex items-center justify-center">
        Cargando tareas…
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-[#EEF3F8] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ListTodo className="h-4 w-4 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate2">
                Tareas · {selectedDateLabel}
              </p>
              <h3 className="font-display font-bold text-navy text-sm truncate capitalize">
                {format(selectedDate, "EEEE d MMMM", { locale: es })}
              </h3>
            </div>
          </div>
          {calendarSrc && todayCalendarUrl && (
            <a
              href={todayCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 shrink-0"
            >
              Google Calendar
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => shiftDate(-1)}
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedDateKey === todayKey ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={onSelectToday}
          >
            Hoy
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedDateKey === tomorrowKey ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={onSelectTomorrow}
          >
            Mañana
          </Button>
          <Input
            type="date"
            value={selectedDateKey}
            onChange={(e) => {
              if (e.target.value) onSelectDate(e.target.value);
            }}
            className="h-8 w-[10.5rem] text-xs"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => shiftDate(1)}
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 divide-y divide-border">
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto min-h-[180px]">
          {dayTasks.length === 0 ? (
            <p className="text-sm text-slate2 py-6 text-center">
              No hay tareas para este día.
            </p>
          ) : (
            dayTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm",
                  task.done
                    ? "bg-mist/50 text-slate2"
                    : "bg-white border border-mist",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    task.done
                      ? "border-emerald-500 bg-emerald-500"
                      : task.status === "en_consulta"
                        ? "border-brand bg-brand"
                        : task.status === "en_espera"
                          ? "border-amber-500 bg-amber-500"
                          : "border-brand",
                  )}
                >
                  {task.done && (
                    <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                <span className={cn("flex-1 min-w-0", task.done && "line-through")}>
                  {task.label}
                </span>
                {task.status && !task.done && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] shrink-0",
                      task.status === "en_espera" &&
                        "bg-amber-50 text-amber-800 border-amber-200",
                      task.status === "en_consulta" &&
                        "bg-brand/10 text-brand border-brand/30",
                    )}
                  >
                    {task.status === "en_espera" ? "En espera" : "En consulta"}
                  </Badge>
                )}
                {task.time && (
                  <span className="text-xs font-mono text-slate2 shrink-0">
                    {task.time}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {todayCalendarUrl ? (
          <div className="shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate2 px-3 pt-2">
              Calendario personal — {selectedDateLabel.toLowerCase()}
            </p>
            <iframe
              title="Calendario personal — hoy"
              src={todayCalendarUrl}
              className="w-full h-[240px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <div className="p-4 flex items-center justify-center text-center shrink-0">
            <p className="text-xs text-slate2 max-w-sm">
              Vinculá tu Google Calendar en{" "}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("nodo:open-settings", { detail: { section: "agenda" } }))}
                className="text-brand font-semibold hover:underline"
              >
                Configuración
              </button>{" "}
              para ver eventos personales del día acá.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
