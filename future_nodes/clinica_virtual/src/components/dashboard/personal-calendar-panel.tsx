"use client";

import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildGoogleCalendarDayEmbed,
  buildGoogleCalendarWeekEmbed,
  parseGoogleCalendarSrc,
} from "@/lib/google-calendar";

interface PersonalCalendarPanelProps {
  calendarId?: string;
}

export function PersonalCalendarPanel({ calendarId }: PersonalCalendarPanelProps) {
  const parsed = calendarId ? parseGoogleCalendarSrc(calendarId) : null;

  if (!parsed) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
        <div className="text-center">
          <CalendarDays className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">
            Calendario personal de Google
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto text-left whitespace-pre-line">
            {`En Configuración del consultorio (⚙️) pegá la URL de Google Calendar.

Ejemplo:
• Configuración → Integrar el calendario → URL pública
• O pegá la URL que empieza con calendar.google.com/calendar/embed?src=…`}
          </p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const weekUrl = buildGoogleCalendarWeekEmbed(parsed);
  const todayUrl = buildGoogleCalendarDayEmbed(parsed, today);
  const tomorrowUrl = buildGoogleCalendarDayEmbed(parsed, tomorrow);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-slate-50 border-b flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500 truncate" title={parsed}>
          Calendario: {parsed}
        </p>
        <a
          href={weekUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"
        >
          Probar enlace
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <Tabs defaultValue="week">
        <TabsList className="w-full grid grid-cols-3 rounded-none bg-slate-100 h-9">
          <TabsTrigger value="week" className="text-[10px]">
            Semana
          </TabsTrigger>
          <TabsTrigger value="today" className="text-[10px]">
            Hoy
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="text-[10px]">
            Mañana
          </TabsTrigger>
        </TabsList>
        <TabsContent value="week" className="m-0">
          <iframe
            title="Calendario personal — semana"
            src={weekUrl}
            className="w-full h-[360px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </TabsContent>
        <TabsContent value="today" className="m-0">
          <iframe
            title="Calendario personal — hoy"
            src={todayUrl}
            className="w-full h-[360px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </TabsContent>
        <TabsContent value="tomorrow" className="m-0">
          <iframe
            title="Calendario personal — mañana"
            src={tomorrowUrl}
            className="w-full h-[360px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </TabsContent>
      </Tabs>
      <p className="text-[10px] text-slate-400 px-3 py-2 border-t">
        Si no ves eventos, verificá que pegaste el ID del calendario «Pela
        Semanales» (no otro) y que esté en «Compartir públicamente».
      </p>
    </div>
  );
}
