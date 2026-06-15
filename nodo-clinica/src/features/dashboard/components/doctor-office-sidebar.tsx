import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { TodayAgendaPanel } from "@/features/dashboard/components/today-agenda-panel";
import { PersonalCalendarPanel } from "@/features/dashboard/components/personal-calendar-panel";

interface DoctorOfficeSidebarProps {
  googleCalendarId?: string;
}

/** Right column: daily summary and personal calendar. */
export function DoctorOfficeSidebar({
  googleCalendarId,
}: DoctorOfficeSidebarProps) {
  return (
    <Card className="border-slate-200 shadow-sm h-full flex flex-col min-h-[500px]">
      <CardHeader className="py-3 px-4 border-b bg-white shrink-0">
        <CardTitle className="text-base font-semibold text-slate-800">
          Mi consultorio
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Resumen del día</p>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-4 flex-1 min-h-0">
        <TodayAgendaPanel />

        <div className="flex-1 min-h-0 flex flex-col pt-2 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-2 shrink-0">
            Calendario personal
          </p>
          <div className="flex-1 min-h-[280px]">
            <PersonalCalendarPanel calendarId={googleCalendarId} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
