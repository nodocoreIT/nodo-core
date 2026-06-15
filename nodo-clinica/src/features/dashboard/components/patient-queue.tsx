import { Button } from "@nodocore/shared-components";
import { Play, CheckCircle, RotateCcw, Users } from "lucide-react";
import { cn } from "@nodocore/shared-components";
import { useConsultationStore } from "@/store/consultation-store";
import type { QueuePatient } from "@/types";
import { formatTime } from "@/shared/lib/utils";

interface PatientQueueProps {
  onStartConsultation: (appointmentId: string) => void;
  onFinishConsultation: (appointmentId: string) => void;
  onResetConsultation: (appointmentId: string) => void;
  onPreviewPatient?: (patient: QueuePatient) => void;
  selectedPreviewId?: string;
}

const STATUS_LABELS: Record<QueuePatient["status"], string> = {
  en_espera: "En espera",
  en_consulta: "En consulta",
  finalizada: "Finalizada",
};

export function PatientQueue({
  onStartConsultation,
  onFinishConsultation,
  onResetConsultation,
  onPreviewPatient,
  selectedPreviewId,
}: PatientQueueProps) {
  const { queue } = useConsultationStore();

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3 p-6">
        <Users className="h-10 w-10 opacity-30" />
        <p className="text-sm text-center">No hay pacientes en la cola hoy</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Cola del día
          <span className="ml-auto rounded-full bg-brand/10 text-brand text-xs font-bold px-2 py-0.5">
            {queue.length}
          </span>
        </h3>
      </div>
      {queue.map((patient) => (
        <div
          key={patient.appointmentId}
          className={cn(
            "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
            selectedPreviewId === patient.appointmentId && "bg-slate-50",
          )}
          onClick={() => onPreviewPatient?.(patient)}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {patient.patientName}
              </p>
              <p className="text-xs text-slate-400">
                {formatTime(patient.scheduledAt)}
              </p>
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                patient.status === "en_espera" && "patient-status-waiting",
                patient.status === "en_consulta" &&
                  "patient-status-in-consultation",
                patient.status === "finalizada" && "patient-status-completed",
              )}
            >
              {STATUS_LABELS[patient.status]}
            </span>
          </div>

          {patient.status === "en_espera" && (
            <Button
              size="sm"
              className="w-full h-7 text-xs bg-brand hover:bg-brand-600"
              onClick={(e) => {
                e.stopPropagation();
                onStartConsultation(patient.appointmentId);
              }}
            >
              <Play className="h-3 w-3 mr-1" />
              Iniciar consulta
            </Button>
          )}

          {patient.status === "en_consulta" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onFinishConsultation(patient.appointmentId);
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Finalizar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetConsultation(patient.appointmentId);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Volver
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
