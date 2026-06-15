import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@nodocore/shared-components";
import { User, FileText, Loader2 } from "lucide-react";
import { fetchClinicalRecords } from "@/shared/lib/api/clinical";
import type { QueuePatient, ClinicalRecord } from "@/types";
import { formatDateTime } from "@/shared/lib/utils";

interface PatientPreviewPanelProps {
  patient: QueuePatient | null;
  onStartConsultation: (appointmentId: string | null) => void;
}

export function PatientPreviewPanel({
  patient,
  onStartConsultation,
}: PatientPreviewPanelProps) {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) {
      setRecords([]);
      return;
    }

    setLoading(true);
    fetchClinicalRecords(patient.patientId)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [patient?.patientId]);

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 gap-3">
        <User className="h-10 w-10 opacity-30" />
        <p className="text-sm">Seleccione un paciente para ver su ficha</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{patient.patientName}</p>
            {patient.patientEmail && (
              <p className="text-xs text-slate-400">{patient.patientEmail}</p>
            )}
          </div>
        </div>
        {patient.appointmentId && patient.status === "en_espera" && (
          <Button
            size="sm"
            className="bg-brand hover:bg-brand-600 shrink-0"
            onClick={() => onStartConsultation(patient.appointmentId)}
          >
            Iniciar consulta
          </Button>
        )}
      </div>

      {patient.intakeReason && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-700 mb-1">
            Motivo de consulta
          </p>
          <p className="text-sm text-amber-900">{patient.intakeReason}</p>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-700">
            Historial clínico
          </h4>
          <span className="text-xs text-slate-400">
            ({records.length} {records.length === 1 ? "registro" : "registros"})
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Sin registros anteriores
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-slate-100 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-700">
                    {record.title}
                  </p>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDateTime(record.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {record.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
