"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Play,
  CheckCircle,
  FileUp,
  RotateCcw,
  RefreshCw,
  FileText,
  Eye,
  Paperclip,
  CalendarDays,
} from "lucide-react";
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from "@/lib/constants";
import { useConsultationStore } from "@/store/consultation-store";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { QueuePatient } from "@/types";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";

interface PatientQueueProps {
  onStartConsultation: (appointmentId: string) => void;
  onFinishConsultation: (appointmentId: string) => void;
  onResetConsultation: (appointmentId: string) => void;
  onClearStuck: () => void;
  onGenerateReport?: (patient: QueuePatient) => void;
  onPreviewPatient?: (patient: QueuePatient) => void;
  selectedPreviewId?: string;
}

function dateKey(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

function dayHeading(key: string) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const d = parseISO(`${key}T12:00:00`);
  const label = format(d, "EEEE d MMM", { locale: es });
  if (key === todayKey) return `Hoy — ${label}`;
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd");
  if (key === tomorrowKey) return `Mañana — ${label}`;
  return label;
}

export function PatientQueue({
  onStartConsultation,
  onFinishConsultation,
  onResetConsultation,
  onClearStuck,
  onGenerateReport,
  onPreviewPatient,
  selectedPreviewId,
}: PatientQueueProps) {
  const { queue, activeAppointment } = useConsultationStore();

  const sortedQueue = [...queue].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const grouped = sortedQueue.reduce<Record<string, QueuePatient[]>>(
    (acc, p) => {
      const key = dateKey(p.scheduledAt);
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {}
  );

  const dayKeys = Object.keys(grouped).sort();

  const stuckCount = sortedQueue.filter(
    (p) => p.status === "en_consulta"
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <CalendarDays className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-800">Próximos turnos</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {sortedQueue.length} turno{sortedQueue.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {stuckCount > 0 && (
        <div className="px-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
            onClick={onClearStuck}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Finalizar {stuckCount} consulta{stuckCount !== 1 ? "s" : ""} colgada
            {stuckCount !== 1 ? "s" : ""}
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedQueue.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No hay turnos en los próximos días laborables
            </p>
          ) : (
            dayKeys.map((key, dayIndex) => (
              <div key={key}>
                {dayIndex > 0 ? (
                  <div className="flex items-center gap-2 py-3 px-1">
                    <div className="flex-1 border-t border-slate-200" />
                    <span className="text-[11px] font-semibold text-slate-500 capitalize shrink-0 px-1">
                      {dayHeading(key)}
                    </span>
                    <div className="flex-1 border-t border-slate-200" />
                  </div>
                ) : (
                  <p className="text-[11px] font-semibold text-slate-500 capitalize px-2 pt-1 pb-2">
                    {dayHeading(key)}
                  </p>
                )}
                <div className="space-y-0">
                  {grouped[key].map((patient) => (
                    <PatientQueueItem
                      key={patient.appointmentId}
                      patient={patient}
                      isActive={activeAppointment?.id === patient.appointmentId}
                      isPreview={selectedPreviewId === patient.appointmentId}
                      onStart={() => onStartConsultation(patient.appointmentId)}
                      onFinish={() =>
                        onFinishConsultation(patient.appointmentId)
                      }
                      onReset={() => onResetConsultation(patient.appointmentId)}
                      onPreview={
                        onPreviewPatient
                          ? () => onPreviewPatient(patient)
                          : undefined
                      }
                      onGenerateReport={
                        onGenerateReport
                          ? () => onGenerateReport(patient)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PatientQueueItem({
  patient,
  isActive,
  isPreview,
  onStart,
  onFinish,
  onReset,
  onPreview,
  onGenerateReport,
}: {
  patient: QueuePatient;
  isActive: boolean;
  isPreview?: boolean;
  onStart: () => void;
  onFinish: () => void;
  onReset: () => void;
  onPreview?: () => void;
  onGenerateReport?: () => void;
}) {
  const inConsultation = patient.status === "en_consulta";
  const isFinished = patient.status === "finalizada";

  return (
    <div
      className={`flex gap-0 border-b border-slate-100 last:border-b-0 py-2 px-1 transition-colors ${
        isActive || inConsultation
          ? "bg-blue-50/60"
          : isPreview
            ? "bg-violet-50/40"
            : "hover:bg-slate-50/80"
      }`}
    >
      <div className="w-[52px] shrink-0 pt-0.5 pr-2 text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-800 leading-none">
          {format(new Date(patient.scheduledAt), "HH:mm")}
        </p>
        <p className="text-[9px] text-slate-400 mt-0.5">hs</p>
      </div>

      <div className="w-px bg-slate-200 self-stretch shrink-0" />

      <div className="flex-1 min-w-0 pl-3">
        <div className="flex items-start gap-2">
          <UserAvatar
            name={patient.patientName}
            photoUrl={patient.patientPhoto}
            size="sm"
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium text-slate-800 truncate">
                {patient.patientName}
              </p>
              {patient.hasNewDocuments && (
                <FileUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              {patient.status !== "programado" && (
                <Badge
                  variant="outline"
                  className={`text-[9px] h-4 px-1 shrink-0 ${LIFECYCLE_COLORS[patient.status]}`}
                >
                  {LIFECYCLE_LABELS[patient.status]}
                </Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              {format(new Date(patient.scheduledAt), "EEE d MMM yyyy", {
                locale: es,
              })}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(patient.documentCount ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1 border-amber-200 text-amber-700"
                >
                  <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                  {patient.documentCount}
                </Badge>
              )}
              {(patient.clinicalRecordCount ?? 0) > 0 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  {patient.clinicalRecordCount} HC
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 pl-8">
        {onPreview && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            className="h-7 text-xs flex-1 min-w-[90px] border-slate-200"
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver ficha
          </Button>
        )}
        {(patient.status === "en_espera" || patient.status === "programado") && (
          <Button
            size="sm"
            onClick={onStart}
            className="h-7 text-xs bg-blue-700 hover:bg-blue-800 flex-1 min-w-[100px]"
          >
            <Play className="h-3 w-3 mr-1" />
            Iniciar
          </Button>
        )}
        {inConsultation && (
          <>
            <Button
              size="sm"
              onClick={onStart}
              className="h-7 text-xs bg-blue-700 hover:bg-blue-800 flex-1 min-w-[90px]"
            >
              <Play className="h-3 w-3 mr-1" />
              {isActive ? "Retomar" : "Abrir"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onFinish}
              className="h-7 text-xs flex-1 min-w-[90px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Finalizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              className="h-7 text-xs flex-1 min-w-[90px] border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Espera
            </Button>
          </>
        )}
        {isFinished && onGenerateReport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateReport}
            className="h-7 text-xs w-full border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            <FileText className="h-3 w-3 mr-1" />
            Generar informe
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
