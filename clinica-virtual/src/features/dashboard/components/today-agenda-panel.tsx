import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { Calendar } from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { formatTime } from "@/shared/lib/utils";

export function TodayAgendaPanel() {
  const { queue } = useConsultationStore();

  const sorted = [...queue].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Calendar className="h-4 w-4 text-brand" />
          Agenda del día
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 p-4">Sin turnos programados</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sorted.map((patient) => (
              <div
                key={patient.appointmentId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="text-xs font-mono text-slate-500 w-12 shrink-0">
                  {formatTime(patient.scheduledAt)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {patient.patientName}
                  </p>
                </div>
                <span
                  className={[
                    "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                    patient.status === "en_espera"
                      ? "patient-status-waiting"
                      : patient.status === "en_consulta"
                        ? "patient-status-in-consultation"
                        : "patient-status-completed",
                  ].join(" ")}
                >
                  {patient.status === "en_espera"
                    ? "Espera"
                    : patient.status === "en_consulta"
                      ? "Consulta"
                      : "OK"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
