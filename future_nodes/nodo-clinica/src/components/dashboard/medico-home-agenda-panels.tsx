"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Hourglass,
  Users,
  ListTodo,
  ExternalLink,
} from "lucide-react";
import { buildGoogleCalendarDayEmbed } from "@/lib/google-calendar";
import { mapAppointmentStatusToLifecycle } from "@/types";
import type { PatientLifecycleStatus } from "@/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

function PatientRow({ apt }: { apt: AppointmentRow }) {
  const lifecycle = mapAppointmentStatusToLifecycle(
    apt.status as "scheduled" | "waiting" | "in_consultation" | "completed" | "cancelled",
  );
  const time = format(new Date(apt.scheduledAt), "HH:mm", { locale: es });

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
          {time}
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
  todayAppts: AppointmentRow[];
  nextDayAppts: AppointmentRow[];
  nextDayKey: string | null;
  todayBlocks: { startTime: string; endTime: string }[];
  stats: { waiting: number; inConsult: number; done: number };
}

export function MedicoHomeAgendaSidebar({
  loading,
  todayAppts,
  nextDayAppts,
  nextDayKey,
  todayBlocks,
  stats,
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

      {/* Pacientes de hoy */}
      <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden flex-1">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-[#EEF3F8]">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate2">
                Pacientes de hoy
              </p>
              <h3 className="font-display font-bold text-navy text-xs capitalize truncate">
                {format(new Date(), "EEEE d MMM", { locale: es })}
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
        <div className="p-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {todayBlocks.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              Hoy no tenés franja de atención.
            </p>
          ) : todayAppts.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              Sin turnos reservados para hoy.
              <span className="block mt-1 text-[10px]">
                Atención:{" "}
                {todayBlocks.map((b) => `${b.startTime}–${b.endTime}`).join(" · ")}
              </span>
            </p>
          ) : (
            todayAppts.map((apt) => <PatientRow key={apt.id} apt={apt} />)
          )}
        </div>
      </section>

      {/* Próximo día */}
      <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-[#EEF3F8]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-navy shrink-0" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate2">
                Próximo día de atención
              </p>
              <h3 className="font-display font-bold text-navy text-xs capitalize">
                {nextDayKey
                  ? format(parseISO(`${nextDayKey}T12:00:00`), "EEEE d MMM", {
                      locale: es,
                    })
                  : "Sin día configurado"}
              </h3>
            </div>
          </div>
        </div>
        <div className="p-2 space-y-1.5 max-h-[180px] overflow-y-auto">
          {!nextDayKey ? (
            <p className="text-xs text-slate2 py-3 text-center">
              Configurá días en Agenda y perfil.
            </p>
          ) : nextDayAppts.length === 0 ? (
            <p className="text-xs text-slate2 py-3 text-center">
              Aún no hay turnos para el próximo día de atención.
            </p>
          ) : (
            nextDayAppts.map((apt) => <PatientRow key={apt.id} apt={apt} />)
          )}
        </div>
      </section>
    </aside>
  );
}

interface MedicoHomeTasksProps {
  loading: boolean;
  todayTasks: TodayTask[];
  calendarSrc: string | null;
}

export function MedicoHomeTasks({
  loading,
  todayTasks,
  calendarSrc,
}: MedicoHomeTasksProps) {
  const todayCalendarUrl = calendarSrc
    ? buildGoogleCalendarDayEmbed(calendarSrc, new Date())
    : null;

  if (loading) {
    return (
      <section className="rounded-md border border-border bg-card p-8 text-center text-sm text-slate2 min-h-[300px] flex items-center justify-center">
        Cargando tareas…
      </section>
    );
  }

  return (
    <section className="rounded-md border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#EEF3F8] shrink-0">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-brand" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate2">
              Tareas de hoy
            </p>
            <h3 className="font-display font-bold text-navy text-sm">
              Agenda y turnos programados
            </h3>
          </div>
        </div>
        {calendarSrc && todayCalendarUrl && (
          <a
            href={todayCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
          >
            Google Calendar
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex flex-col flex-1 divide-y divide-border">
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto min-h-[180px]">
          {todayTasks.length === 0 ? (
            <p className="text-sm text-slate2 py-6 text-center">
              No hay tareas para hoy.
            </p>
          ) : (
            todayTasks.map((task) => (
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
                      : "border-brand",
                  )}
                >
                  {task.done && (
                    <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                <span className={cn("flex-1", task.done && "line-through")}>
                  {task.label}
                </span>
                {task.time && (
                  <span className="text-xs font-mono text-slate2">{task.time}</span>
                )}
              </div>
            ))
          )}
        </div>

        {todayCalendarUrl ? (
          <div className="shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate2 px-3 pt-2">
              Calendario personal — hoy
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
              <Link
                href="/medico/configuracion"
                className="text-brand font-semibold hover:underline"
              >
                Agenda y perfil
              </Link>{" "}
              para ver eventos personales del día acá.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
