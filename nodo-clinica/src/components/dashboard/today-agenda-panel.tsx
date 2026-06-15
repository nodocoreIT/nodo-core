"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from "@/lib/constants";
import type { QueuePatient } from "@/types";

interface TodayAgendaPanelProps {
  queue: QueuePatient[];
  onSelectPatient: (patient: QueuePatient) => void;
  selectedId?: string;
  statsOnly?: boolean;
}

export function TodayAgendaPanel({
  queue,
  onSelectPatient,
  selectedId,
  statsOnly = false,
}: TodayAgendaPanelProps) {
  const sorted = [...queue].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const grouped = sorted.reduce<Record<string, QueuePatient[]>>((acc, p) => {
    const key = format(new Date(p.scheduledAt), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const waiting = sorted.filter((p) => p.status === "en_espera").length;
  const inConsult = sorted.filter((p) => p.status === "en_consulta").length;
  const done = sorted.filter((p) => p.status === "finalizada").length;

  const statsBlock = (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-center">
        <Hourglass className="h-4 w-4 text-amber-600 mx-auto mb-1" />
        <p className="text-lg font-semibold text-slate-800">{waiting}</p>
        <p className="text-[10px] text-slate-500">En espera</p>
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-center">
        <Users className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
        <p className="text-lg font-semibold text-slate-800">{inConsult}</p>
        <p className="text-[10px] text-slate-500">En consulta</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
        <CheckCircle2 className="h-4 w-4 text-slate-500 mx-auto mb-1" />
        <p className="text-lg font-semibold text-slate-800">{done}</p>
        <p className="text-[10px] text-slate-500">Finalizados</p>
      </div>
    </div>
  );

  if (statsOnly) {
    return statsBlock;
  }

  return (
    <div className="space-y-4">
      {statsBlock}

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="h-4 w-4 text-blue-600" />
        Próximos días laborables
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">
          No hay turnos en los próximos días laborables
        </p>
      ) : (
        <ScrollArea className="h-[380px] pr-2">
          <div className="space-y-4">
            {Object.keys(grouped)
              .sort()
              .map((key) => (
                <div key={key}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    {key === todayKey
                      ? `Hoy — ${format(parseISO(`${key}T12:00:00`), "EEEE d MMM", { locale: es })}`
                      : format(parseISO(`${key}T12:00:00`), "EEEE d MMM", {
                          locale: es,
                        })}
                  </p>
                  <div className="space-y-2">
                    {grouped[key].map((patient) => (
                      <button
                        key={patient.appointmentId}
                        type="button"
                        onClick={() => onSelectPatient(patient)}
                        className={`w-full text-left rounded-lg border p-3 transition-all ${
                          selectedId === patient.appointmentId
                            ? "border-blue-300 bg-blue-50/50 shadow-sm"
                            : "border-slate-100 bg-white hover:border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={patient.patientName}
                            photoUrl={patient.patientPhoto}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {patient.patientName}
                              </p>
                              {(patient.documentCount ?? 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 border-amber-200 text-amber-700 shrink-0"
                                >
                                  {patient.documentCount} arch.
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {format(new Date(patient.scheduledAt), "HH:mm", {
                                locale: es,
                              })}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${LIFECYCLE_COLORS[patient.status]}`}
                          >
                            {LIFECYCLE_LABELS[patient.status]}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
