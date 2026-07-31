"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Scan } from "lucide-react";
import { getClientSession } from "@/lib/clinic/client-api";
import { DashboardActionCard } from "@/components/dashboard/dashboard-action-card";
import { PharmacyOnCallCard } from "@/components/patient/pharmacy-on-call-card";
import { MedicalDirectoryCard } from "@/components/patient/medical-directory-card";

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

  useEffect(() => {
    setPatientName(getClientSession()?.fullName ?? "");
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
            Hola{patientName ? `, ${patientName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-slate2">Hoy es {todayLabel()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PharmacyOnCallCard />
        <MedicalDirectoryCard
          category="laboratorio"
          title="Laboratorios de análisis clínicos"
          icon={FlaskConical}
          tone="sky"
          emptyLabel="Todavía no se cargó el listado de laboratorios."
        />
        <MedicalDirectoryCard
          category="diagnostico_imagenes"
          title="Diagnóstico por imágenes"
          icon={Scan}
          tone="violet"
          emptyLabel="Todavía no se cargó el listado de centros de diagnóstico."
        />
      </div>
    </div>
  );
}
