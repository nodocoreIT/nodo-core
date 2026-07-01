"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodayAgendaPanel } from "@/components/dashboard/today-agenda-panel";
import { PersonalCalendarPanel } from "@/components/dashboard/personal-calendar-panel";
import type { QueuePatient } from "@/types";
import { BarChart3, Calendar } from "lucide-react";

export function ConsultorioDaySummaryWidget({
  queue,
}: {
  queue: QueuePatient[];
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-2 px-3 border-b bg-white shrink-0">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand" />
          Resumen del día
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <TodayAgendaPanel queue={queue} onSelectPatient={() => {}} statsOnly />
      </CardContent>
    </Card>
  );
}

export function ConsultorioCalendarWidget({
  googleCalendarId,
}: {
  googleCalendarId?: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm flex flex-col min-h-[220px]">
      <CardHeader className="py-2 px-3 border-b bg-white shrink-0">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand" />
          Calendario personal
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex-1 min-h-[200px]">
        <PersonalCalendarPanel calendarId={googleCalendarId} />
      </CardContent>
    </Card>
  );
}
