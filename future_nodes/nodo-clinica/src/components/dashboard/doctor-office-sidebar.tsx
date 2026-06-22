"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodayAgendaPanel } from "@/components/dashboard/today-agenda-panel";
import { PersonalCalendarPanel } from "@/components/dashboard/personal-calendar-panel";
import type { QueuePatient } from "@/types";

interface DoctorOfficeSidebarProps {
  queue: QueuePatient[];
  googleCalendarId?: string;
}

/** Columna derecha: resumen del día y calendario personal. */
export function DoctorOfficeSidebar({
  queue,
  googleCalendarId,
}: DoctorOfficeSidebarProps) {
  return (
    <Card className="border-slate-200 shadow-sm h-full flex flex-col min-h-[420px]">
      <CardHeader className="py-2 px-3 border-b bg-white shrink-0">
        <CardTitle className="text-sm font-semibold text-slate-800">
          Mi consultorio
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex flex-col gap-3 flex-1 min-h-0">
        <TodayAgendaPanel queue={queue} onSelectPatient={() => {}} statsOnly />

        <div className="flex-1 min-h-0 flex flex-col pt-2 border-t border-slate-100">
          <p className="text-[10px] font-medium text-slate-500 mb-1.5 shrink-0">
            Calendario personal
          </p>
          <div className="flex-1 min-h-[180px]">
            <PersonalCalendarPanel calendarId={googleCalendarId} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
