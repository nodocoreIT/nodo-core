import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { Zap, History, Mic, FileEdit, Paperclip, FileText } from "lucide-react";
import { ClinicalHistoryViewer } from "./clinical-history-viewer";
import { TranscriptionPanel } from "./transcription-panel";
import { ClinicalNotesEditor } from "./clinical-notes-editor";
import { PatientDocumentsPanel } from "@/features/medical/patient-documents-panel";
import { MedicalReportPanel } from "@/features/medical/medical-report-panel";
import { useConsultationStore } from "@/store/consultation-store";

interface ImmediateActionPanelProps {
  appointmentId: string;
  doctorId: string;
  patientId?: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  onReportSaved?: () => void;
}

export function ImmediateActionPanel({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  patientEmail,
  patientPhone,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  onReportSaved,
}: ImmediateActionPanelProps) {
  const { clinicalHistory, hasActiveSession, notesEditorFocusRequest } =
    useConsultationStore();
  const [activeTab, setActiveTab] = useState("files");

  useEffect(() => {
    if (notesEditorFocusRequest > 0) {
      setActiveTab("notes");
    }
  }, [notesEditorFocusRequest]);

  if (!hasActiveSession()) {
    return (
      <Card className="border-slate-200 h-full">
        <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Zap className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Acción Inmediata</p>
          <p className="text-xs mt-1">Seleccione un paciente en consulta</p>
        </CardContent>
      </Card>
    );
  }

  const canReport = !!(patientId && patientName && doctorName);

  return (
    <Card className="border-slate-200 h-full shadow-sm">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600" />
          Acción Inmediata
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-100">
            <TabsTrigger value="files" className="text-xs gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              Archivos
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1">
              <History className="h-3.5 w-3.5" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Informe
            </TabsTrigger>
            <TabsTrigger value="transcription" className="text-xs gap-1">
              <Mic className="h-3.5 w-3.5" />
              Voz
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1">
              <FileEdit className="h-3.5 w-3.5" />
              Notas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="mt-3">
            <PatientDocumentsPanel appointmentId={appointmentId} />
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            <ClinicalHistoryViewer
              records={clinicalHistory}
              onGenerateReport={canReport ? () => setActiveTab("report") : undefined}
            />
          </TabsContent>
          <TabsContent value="report" className="mt-3">
            {canReport ? (
              <MedicalReportPanel
                appointmentId={appointmentId}
                patientId={patientId!}
                patientName={patientName!}
                patientEmail={patientEmail}
                patientPhone={patientPhone}
                doctorId={doctorId}
                doctorName={doctorName!}
                doctorSpecialty={doctorSpecialty}
                doctorLicense={doctorLicense}
                compact
                onSaved={onReportSaved}
              />
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                Informes disponibles cuando haya un paciente activo
              </p>
            )}
          </TabsContent>
          <TabsContent value="transcription" className="mt-3">
            <TranscriptionPanel />
          </TabsContent>
          <TabsContent value="notes" className="mt-3">
            <ClinicalNotesEditor
              appointmentId={appointmentId}
              doctorId={doctorId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
