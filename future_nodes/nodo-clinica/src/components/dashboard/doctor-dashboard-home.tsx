"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Search,
  Building2,
} from "lucide-react";
import { TodayAgendaPanel } from "@/components/dashboard/today-agenda-panel";
import { PatientSearchPanel } from "@/components/dashboard/patient-search-panel";
import { DoctorOfficePanel } from "@/components/medical/doctor-office-panel";
import { PersonalCalendarPanel } from "@/components/dashboard/personal-calendar-panel";
import type { QueuePatient } from "@/types";

interface DoctorDashboardHomeProps {
  doctorId: string;
  doctorName: string;
  queue: QueuePatient[];
  googleCalendarId?: string;
  selectedPatientId?: string;
  onSelectQueuePatient: (patient: QueuePatient) => void;
  onSelectSearchedPatient: (patient: {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
    patientPhoto?: string;
  }) => void;
}

export function DoctorDashboardHome({
  doctorId,
  queue,
  googleCalendarId,
  selectedPatientId,
  onSelectQueuePatient,
  onSelectSearchedPatient,
}: DoctorDashboardHomeProps) {
  const [tab, setTab] = useState("agenda");

  return (
    <Card className="border-slate-200 shadow-sm min-h-[500px]">
      <CardHeader className="py-3 px-4 border-b bg-white">
        <CardTitle className="text-base font-semibold text-slate-800">
          Mi consultorio
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Agenda, calendario personal, pacientes y configuración
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <PersonalCalendarPanel calendarId={googleCalendarId} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-100">
            <TabsTrigger value="agenda" className="text-xs gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Turnos
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs gap-1">
              <Search className="h-3.5 w-3.5" />
              Pacientes
            </TabsTrigger>
            <TabsTrigger value="office" className="text-xs gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Perfil
            </TabsTrigger>
          </TabsList>
          <TabsContent value="agenda" className="mt-4">
            <TodayAgendaPanel
              queue={queue}
              onSelectPatient={onSelectQueuePatient}
              selectedId={selectedPatientId}
            />
          </TabsContent>
          <TabsContent value="search" className="mt-4">
            <PatientSearchPanel
              doctorId={doctorId}
              onSelectPatient={(p) => {
                onSelectSearchedPatient(p);
                setTab("agenda");
              }}
            />
          </TabsContent>
          <TabsContent value="office" className="mt-4">
            <DoctorOfficePanel doctorId={doctorId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
