import { useEffect, useState } from "react";
import { useAuth } from "@nodocore/shared-components";
import { PatientSearchPanel } from "@/features/dashboard/components/patient-search-panel";
import { ClinicalHistoryViewer } from "@/features/consultation/clinical-history-viewer";
import { PatientDocumentsPanel } from "@/features/medical/patient-documents-panel";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { ClinicalRecord } from "@/types";

interface SelectedPatient {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
}

function PatientDetail({
  patient,
  doctorId,
  onBack,
}: {
  patient: SelectedPatient;
  doctorId: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"historia" | "documentos">("historia");
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [appointments, setAppointments] = useState<{ id: string; scheduled_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: recs }, { data: apts }] = await Promise.all([
        supabase
          .from("clinical_records")
          .select("*")
          .eq("patient_id", patient.patientId)
          .eq("doctor_id", doctorId)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("id, scheduled_at")
          .eq("patient_id", patient.patientId)
          .eq("doctor_id", doctorId)
          .order("scheduled_at", { ascending: false })
          .limit(20),
      ]);
      setRecords((recs ?? []) as ClinicalRecord[]);
      setAppointments(apts ?? []);
      setLoading(false);
    };
    void fetchData();
  }, [patient.patientId, doctorId]);

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div>
          <h2 className="font-semibold text-navy">{patient.patientName}</h2>
          {patient.patientEmail && (
            <p className="text-xs text-slate2">{patient.patientEmail}</p>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200">
        {(["historia", "documentos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === t
                ? "border-brand text-brand"
                : "border-transparent text-slate2 hover:text-navy",
            ].join(" ")}
          >
            {t === "historia" ? "Historia clínica" : "Documentos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : tab === "historia" ? (
        <ClinicalHistoryViewer records={records} />
      ) : (
        <div className="space-y-4">
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin consultas registradas</p>
          ) : (
            appointments.map((apt) => (
              <div key={apt.id}>
                <p className="text-xs font-semibold text-slate2 mb-2 uppercase tracking-wide">
                  Consulta {new Date(apt.scheduled_at).toLocaleDateString("es-AR")}
                </p>
                <PatientDocumentsPanel appointmentId={apt.id} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PacientesPage() {
  const { session } = useAuth();
  const doctorId = session?.user.id ?? "";
  const [selected, setSelected] = useState<SelectedPatient | null>(null);

  if (!doctorId) return null;

  if (selected) {
    return (
      <PatientDetail
        patient={selected}
        doctorId={doctorId}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold text-navy">Pacientes</h2>
      </div>
      <PatientSearchPanel
        doctorId={doctorId}
        onSelectPatient={setSelected}
      />
    </div>
  );
}
