"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientSession } from "@/lib/clinic/client-api";
import { DashboardActionCard } from "@/components/dashboard/dashboard-action-card";
import { UtilitiesModal } from "@/components/patient/utilities-modal";
import { SidebarUpcomingAppointments } from "@/components/patient/sidebar-upcoming-appointments";
import { SidebarAdSpace } from "@/components/patient/sidebar-ad-space";

function todayLabel(): string {
  const formatted = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function PacienteHomePage() {
  const [patientName, setPatientName] = useState("");
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);

  useEffect(() => {
    setPatientName(getClientSession()?.fullName ?? "");
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
            Hola{patientName ? `, ${patientName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-slate2">Hoy es {todayLabel()}</p>
        </div>
        <Button
          onClick={() => setUtilitiesOpen(true)}
          variant="outline"
          size="sm"
          className="gap-2 border-emerald-200 hover:bg-emerald-50"
        >
          <Zap className="h-4 w-4" />
          Utilidades y servicios útiles
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main action cards: 2x2 grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardActionCard
              badge="Turnos"
              title="Mis turnos"
              description="Consultá, reprogramá o cancelá tus turnos reservados."
              buttonLabel="Ver mis turnos"
              href="/paciente/turnos"
              tone="brand"
            />
            <DashboardActionCard
              badge="Documentación"
              title="Mis estudios"
              description="Subí y consultá tus estudios y análisis médicos."
              buttonLabel="Ver mis estudios"
              href="/paciente/estudios"
              tone="navy"
            />
            <DashboardActionCard
              badge="Historial"
              title="Historial clínico"
              description="Revisá el historial de tus consultas y diagnósticos."
              buttonLabel="Ver historial"
              href="/paciente/historial"
              tone="amber"
            />
            <DashboardActionCard
              badge="Atención"
              title="Buscar médico"
              description="Encontrá especialistas disponibles y pedí turno online."
              buttonLabel="Buscar médico"
              href="/paciente"
              tone="slate"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SidebarUpcomingAppointments />
          <SidebarAdSpace />
        </div>
      </div>

      <UtilitiesModal
        open={utilitiesOpen}
        onOpenChange={setUtilitiesOpen}
      />
    </>
  );
}
