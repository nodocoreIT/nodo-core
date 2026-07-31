"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, History, FileEdit, Paperclip, FileText } from "lucide-react";
import { ClinicalHistoryViewer } from "./clinical-history-viewer";
import { ClinicalNotesEditor } from "./clinical-notes-editor";
import { PatientDocumentsPanel } from "@/components/medical/patient-documents-panel";
import { MedicalReportPanel } from "@/components/medical/medical-report-panel";
import { parseReportSections } from "@/components/medical/report-editor-dialog";
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
  dataSource?: "local" | "supabase";
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
  dataSource = "supabase",
  onReportSaved,
}: ImmediateActionPanelProps) {
  const {
    clinicalHistory,
    setClinicalHistory,
    hasActiveSession,
    notesEditorFocusRequest,
    reportFocusRequest,
  } = useConsultationStore();
  const [activeTab, setActiveTab] = useState("files");

  useEffect(() => {
    if (notesEditorFocusRequest > 0) {
      setActiveTab("notes");
    }
  }, [notesEditorFocusRequest]);

  useEffect(() => {
    if (reportFocusRequest > 0 && dataSource === "local") {
      setActiveTab("report");
    }
  }, [reportFocusRequest, dataSource]);

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

  const canReport =
    dataSource === "local" && patientId && patientName && doctorName;

  // Fuera del modo demo, el informe se genera/edita desde el acordeón de la
  // columna derecha (ConsultationToolsSidebar) — este tab muestra el último
  // guardado para ESTA consulta, en solo lectura, así queda visible acá
  // también y no solo en Historial.
  const savedReport = clinicalHistory
    .filter(
      (r) =>
        r.record_type === "informe" &&
        (!appointmentId || r.appointment_id === appointmentId),
    )
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

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
          <TabsList className="flex w-full flex-wrap gap-3 bg-slate-100">
            <TabsTrigger value="files" className="flex-none text-xs gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              Archivos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-none text-xs gap-1">
              <History className="h-3.5 w-3.5" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="report" className="flex-none text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Informe
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-none text-xs gap-1">
              <FileEdit className="h-3.5 w-3.5" />
              Notas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="mt-3">
            {dataSource === "local" ? (
              <PatientDocumentsPanel appointmentId={appointmentId} />
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                Archivos disponibles en modo local
              </p>
            )}
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            <ClinicalHistoryViewer
              records={clinicalHistory}
              onGenerateReport={canReport ? () => setActiveTab("report") : undefined}
              onDeleted={(id) =>
                setClinicalHistory(clinicalHistory.filter((r) => r.id !== id))
              }
            />
          </TabsContent>
          <TabsContent value="report" className="mt-3">
            {canReport ? (
              <MedicalReportPanel
                appointmentId={appointmentId}
                patientId={patientId}
                patientName={patientName}
                patientEmail={patientEmail}
                patientPhone={patientPhone}
                doctorId={doctorId}
                doctorName={doctorName}
                doctorSpecialty={doctorSpecialty}
                doctorLicense={doctorLicense}
                compact
                onSaved={onReportSaved}
              />
            ) : savedReport ? (
              <div className="space-y-4">
                {parseReportSections(savedReport.content).map((section, index) => (
                  <div key={index} className="space-y-1">
                    {section.title && (
                      <h3 className="text-xs font-semibold text-[#1e406e]">
                        {section.title}
                      </h3>
                    )}
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                Todavía no se guardó un informe para esta consulta.
              </p>
            )}
          </TabsContent>
          <TabsContent value="notes" className="mt-3">
            <ClinicalNotesEditor
              appointmentId={appointmentId}
              doctorId={doctorId}
              dataSource={dataSource}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
