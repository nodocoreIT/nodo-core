import { useState } from "react";
import { useAuth } from "@nodocore/shared-components";
import { PatientSearchPanel } from "@/features/dashboard/components/patient-search-panel";
import { ClinicalHistoryViewer } from "@/features/consultation/clinical-history-viewer";
import { PatientDocumentsPanel } from "@/features/medical/patient-documents-panel";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@nodocore/shared-components";

interface SelectedPatient {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
}

export function PacientesPage() {
  const { session } = useAuth();
  const doctorId = session?.user.id ?? "";
  const [selected, setSelected] = useState<SelectedPatient | null>(null);
  const [detailTab, setDetailTab] = useState<"historia" | "documentos">("historia");

  if (!doctorId) return null;

  if (selected) {
    return (
      <div className="max-w-3xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h2 className="font-semibold text-navy">{selected.patientName}</h2>
            {selected.patientEmail && (
              <p className="text-xs text-slate2">{selected.patientEmail}</p>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-200">
          {(["historia", "documentos"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 capitalize transition-colors",
                detailTab === tab
                  ? "border-brand text-brand"
                  : "border-transparent text-slate2 hover:text-navy",
              ].join(" ")}
            >
              {tab === "historia" ? "Historia clínica" : "Documentos"}
            </button>
          ))}
        </div>

        {detailTab === "historia" && (
          <ClinicalHistoryViewer
            patientId={selected.patientId}
            doctorId={doctorId}
          />
        )}
        {detailTab === "documentos" && (
          <PatientDocumentsPanel
            patientId={selected.patientId}
            doctorId={doctorId}
          />
        )}
      </div>
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
