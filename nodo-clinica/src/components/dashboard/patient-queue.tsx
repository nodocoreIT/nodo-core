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
  ChevronDown,
  ChevronRight,
  Loader2,
  History,
  AlertCircle,
} from "lucide-react";
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from "@/lib/constants";
import { useConsultationStore } from "@/store/consultation-store";
import type { QueuePatient } from "@/types";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";
import type { PatientQueueViewMode } from "@/lib/clinic/consultorio-layout";
import { clinicApi } from "@/lib/clinic/client-api";
import { cn } from "@/lib/utils";

interface PatientQueueProps {
  onStartConsultation: (appointmentId: string) => void;
  onFinishConsultation: (appointmentId: string) => void;
  onResetConsultation: (appointmentId: string) => void;
  onClearStuck: () => void;
  onGenerateReport?: (patient: QueuePatient) => void;
  onPreviewPatient?: (patient: QueuePatient) => void;
  selectedPreviewId?: string;
  viewMode?: PatientQueueViewMode;
  doctorId?: string;
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
  viewMode = "comfortable",
  doctorId,
}: PatientQueueProps) {
  const { queue, activeAppointment } = useConsultationStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedQueue = [...queue].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  const grouped = sortedQueue.reduce<Record<string, QueuePatient[]>>(
    (acc, p) => {
      const key = dateKey(p.scheduledAt);
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    },
    {},
  );

  const dayKeys = Object.keys(grouped).sort();

  const stuckCount = sortedQueue.filter(
    (p) => p.status === "en_consulta",
  ).length;

  const isCompact = viewMode === "compact";
  const loadHistoryOnExpand = viewMode === "expandable";

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <CalendarDays className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-navy">Próximos turnos</h3>
        <Badge variant="outline" className="ml-auto text-xs border-brand/30 text-brand">
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
        <div className={cn("p-2", isCompact && "p-1")}>
          {sortedQueue.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                Sin turnos programados
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Los pacientes que reserven aparecerán acá
              </p>
            </div>
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
                      isCompact={isCompact}
                      loadHistoryOnExpand={loadHistoryOnExpand}
                      expanded={expandedId === patient.appointmentId}
                      onToggleExpand={() =>
                        setExpandedId((id) =>
                          id === patient.appointmentId
                            ? null
                            : patient.appointmentId,
                        )
                      }
                      doctorId={doctorId}
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

function PatientQueueExpandedDetails({
  patient,
  doctorId,
}: {
  patient: QueuePatient;
  doctorId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [records, setRecords] = useState<
    Array<{ title: string; content: string; createdAt: string }>
  >([]);
  const [health, setHealth] = useState<{
    allergies?: string;
    chronicConditions?: string;
    medications?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    clinicApi
      .getPatientHistory(patient.patientId, doctorId)
      .then((data) => {
        if (cancelled) return;
        setRecords(
          (data.clinicalRecords ?? []).slice(0, 3).map((r) => ({
            title: r.title,
            content: r.content,
            createdAt: r.createdAt,
          })),
        );
        setHealth(data.healthProfile ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.patientId, doctorId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando historia…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-600 py-1">No se pudo cargar la historia</p>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100 mt-2">
      {patient.intakeReason && (
        <div className="rounded-md bg-violet-50 border border-violet-100 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-violet-700 uppercase">
            Motivo de consulta
          </p>
          <p className="text-xs text-slate-700 mt-0.5 line-clamp-3">
            {patient.intakeReason}
          </p>
        </div>
      )}
      {health?.allergies && (
        <div className="flex gap-1.5 text-xs text-amber-800 bg-amber-50 rounded px-2 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Alergias:</strong> {health.allergies}
          </span>
        </div>
      )}
      {health?.chronicConditions && (
        <p className="text-xs text-slate-600">
          <strong>Antecedentes:</strong> {health.chronicConditions}
        </p>
      )}
      {records.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
            <History className="h-3 w-3" />
            Últimos registros
          </p>
          <ul className="space-y-1">
            {records.map((r, i) => (
              <li
                key={i}
                className="text-[11px] text-slate-600 bg-slate-50 rounded px-2 py-1"
              >
                <span className="font-medium">{r.title}</span>
                <span className="text-slate-400">
                  {" "}
                  · {format(new Date(r.createdAt), "d/M/yy")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {patient.patientEmail && (
        <p className="text-[10px] text-slate-400">{patient.patientEmail}</p>
      )}
    </div>
  );
}

function PatientQueueItem({
  patient,
  isActive,
  isPreview,
  isCompact,
  loadHistoryOnExpand,
  expanded,
  onToggleExpand,
  doctorId,
  onStart,
  onFinish,
  onReset,
  onPreview,
  onGenerateReport,
}: {
  patient: QueuePatient;
  isActive: boolean;
  isPreview?: boolean;
  isCompact?: boolean;
  loadHistoryOnExpand?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  doctorId?: string;
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
      className={cn(
        "border-b border-slate-100 last:border-b-0 transition-colors",
        isCompact ? "py-1 px-0.5" : "py-1.5 px-1",
        isActive || inConsultation
          ? "bg-brand/5 border-l-2 border-l-brand"
          : isPreview
            ? "bg-violet-50/40"
            : "hover:bg-slate-50/80",
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2 text-left min-h-[36px]"
      >
        <span className="w-5 shrink-0 flex items-center justify-center text-slate-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <span className="w-[42px] shrink-0 text-sm font-semibold tabular-nums text-slate-800">
          {format(new Date(patient.scheduledAt), "HH:mm")}
        </span>
        <span
          className={cn(
            "flex-1 min-w-0 font-medium text-slate-800 truncate",
            isCompact ? "text-xs" : "text-sm",
          )}
        >
          {patient.patientName}
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] h-4 px-1 shrink-0",
            LIFECYCLE_COLORS[patient.status],
          )}
        >
          {LIFECYCLE_LABELS[patient.status]}
        </Badge>
        {patient.hasNewDocuments && (
          <FileUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className={cn("pb-2 pl-7 pr-1", isCompact && "pl-6")}>
          {!isCompact && (
            <p className="text-[10px] text-slate-400 mb-1.5">
              {format(new Date(patient.scheduledAt), "EEEE d MMM yyyy", {
                locale: es,
              })}
            </p>
          )}

          <div className="flex flex-wrap gap-1 mb-2">
            {(patient.documentCount ?? 0) > 0 && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1 border-amber-200 text-amber-700"
              >
                <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                {patient.documentCount} adjunto
                {(patient.documentCount ?? 0) !== 1 ? "s" : ""}
              </Badge>
            )}
            {(patient.clinicalRecordCount ?? 0) > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {patient.clinicalRecordCount} HC
              </Badge>
            )}
          </div>

          {patient.intakeReason && (
            <p className="text-[11px] text-violet-700 bg-violet-50 rounded px-2 py-1 mb-2 line-clamp-3">
              {patient.intakeReason}
            </p>
          )}

          {loadHistoryOnExpand && (
            <PatientQueueExpandedDetails
              patient={patient}
              doctorId={doctorId}
            />
          )}

          <div className="mt-2 flex flex-wrap gap-1">
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
            {patient.status === "en_espera" && (
              <Button
                size="sm"
                onClick={onStart}
                className="h-7 text-xs bg-brand hover:bg-brand-600 flex-1 min-w-[100px]"
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
                  className="h-7 text-xs bg-brand hover:bg-brand-600 flex-1 min-w-[90px]"
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
      )}
    </div>
  );
}
