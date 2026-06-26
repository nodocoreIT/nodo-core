"use client";

import Link from "next/link";
import { DashboardActionCard } from "@/components/dashboard/dashboard-action-card";
import {
  MedicoHomeAgendaSidebar,
  MedicoHomeTasks,
} from "@/components/dashboard/medico-home-agenda-panels";
import { useMedicoHomeAgenda } from "@/hooks/use-medico-home-agenda";

interface MedicoHomePanelProps {
  doctorId: string;
  doctorName: string;
}

function todayLabel(): string {
  const formatted = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function greetingName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first || "Doctor/a";
}

export function MedicoHomePanel({ doctorId, doctorName }: MedicoHomePanelProps) {
  const agenda = useMedicoHomeAgenda(doctorId);

  return (
    <div className="space-y-5">
      {/* Saludo */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
            Hola, {greetingName(doctorName)}
          </h2>
          <p className="mt-1 text-sm text-slate2">Hoy es {todayLabel()}</p>
        </div>
        <Link
          href="/medico/consultorio"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-navy shadow-sm hover:bg-mist"
        >
          Ir al consultorio
        </Link>
      </div>

      {/* 4 cubos de acceso rápido */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardActionCard
          badge="Atención"
          title="Consultorio"
          description="Cola de pacientes, videoconsulta, recetas e informes clínicos."
          buttonLabel="Abrir consultorio"
          href="/medico/consultorio"
          tone="brand"
        />
        <DashboardActionCard
          badge="Colaboración"
          title="Interconsultas"
          description="Chat interno con colegas: consultá casos clínicos y mirá quién está en línea."
          buttonLabel="Abrir chat médico"
          href="/medico/interconsultas"
          tone="navy"
        />
        <DashboardActionCard
          badge="Agenda"
          title="Turnos y horarios"
          description="Agenda, perfil, cobros, recordatorios y apariencia del panel."
          buttonLabel="Abrir configuración"
          href="/medico/configuracion"
          tone="amber"
        />
        <DashboardActionCard
          badge="Documentación"
          title="Recetas y estudios"
          description="Generá recetas, pedidos de estudio e informes con dictado por voz."
          buttonLabel="Ir al consultorio"
          href="/medico/consultorio"
          tone="slate"
        />
      </div>

      {/* Tareas (izq) + Agenda lateral (der) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-4 items-start">
        <MedicoHomeTasks
          loading={agenda.loading}
          todayTasks={agenda.todayTasks}
          calendarSrc={agenda.calendarSrc}
        />
        <MedicoHomeAgendaSidebar
          loading={agenda.loading}
          todayAppts={agenda.todayAppts}
          upcomingAppts={agenda.upcomingAppts}
          todayBlocks={agenda.todayBlocks}
          stats={agenda.stats}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate2">
          Clínica Virtual
        </p>
        <h3 className="mt-1 font-display text-lg font-bold text-navy">
          Tu consultorio digital Nodo Salud
        </h3>
        <p className="mt-2 text-sm text-slate2 max-w-2xl">
          Los pacientes reservan turno online, se conectan por videollamada y vos
          gestionás la documentación clínica desde un solo panel — con la misma
          estética y personalización que el ecosistema Nodo Core.
        </p>
      </div>
    </div>
  );
}
