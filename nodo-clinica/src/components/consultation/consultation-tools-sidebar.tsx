"use client";

import { useEffect, useState } from "react";
import { Pill, FlaskConical, Stethoscope, FileEdit } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { PrescriptionForm } from "@/components/medical/prescription-form";
import { StudyRequestForm } from "@/components/medical/study-request-form";
import { MedicalReportPanel } from "@/components/medical/medical-report-panel";
import { ClinicalNotesEditor } from "@/components/consultation/clinical-notes-editor";
import { useConsultationStore } from "@/store/consultation-store";

interface ConsultationToolsSidebarProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  dataSource?: "local" | "supabase";
  onSaved?: () => void;
}

/**
 * Receta / Estudios / Informe / Notas como acordeón vertical, siempre visible
 * al lado del video durante una consulta activa — antes vivían en pestañas
 * horizontales debajo del video, obligando a scrollear para llegar a ellas
 * en plena llamada. Cada sección reutiliza el mismo componente que ya
 * existía; ImmediateActionPanel (debajo del video) no se toca.
 */
export function ConsultationToolsSidebar({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  patientEmail,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  dataSource,
  onSaved,
}: ConsultationToolsSidebarProps) {
  const reportFocusRequest = useConsultationStore((s) => s.reportFocusRequest);
  const [openSection, setOpenSection] = useState<string[]>(["prescription"]);

  useEffect(() => {
    if (reportFocusRequest > 0) {
      setOpenSection(["report"]);
    }
  }, [reportFocusRequest]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Accordion
        value={openSection}
        onValueChange={setOpenSection}
        keepMounted
        className="px-4"
      >
        <AccordionItem value="prescription">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-slate-700">
              <Pill className="h-4 w-4 text-blue-600" />
              Receta <span className="text-slate-400 font-normal">(Recetario Digital)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <PrescriptionForm
              appointmentId={appointmentId}
              doctorId={doctorId}
              patientId={patientId}
              patientName={patientName}
              doctorName={doctorName}
              doctorSpecialty={doctorSpecialty}
              doctorLicense={doctorLicense}
              patientEmail={patientEmail}
              onSaved={onSaved}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="studies">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-slate-700">
              <FlaskConical className="h-4 w-4 text-blue-600" />
              Estudios <span className="text-slate-400 font-normal">(Solicitud de Estudios)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <StudyRequestForm
              appointmentId={appointmentId}
              doctorId={doctorId}
              patientId={patientId}
              patientName={patientName}
              doctorName={doctorName}
              doctorSpecialty={doctorSpecialty}
              doctorLicense={doctorLicense}
              onSaved={onSaved}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="report">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-slate-700">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              Informe <span className="text-slate-400 font-normal">(Informe clínico con IA)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <MedicalReportPanel
              appointmentId={appointmentId}
              patientId={patientId}
              patientName={patientName}
              patientEmail={patientEmail}
              doctorId={doctorId}
              doctorName={doctorName}
              doctorSpecialty={doctorSpecialty}
              doctorLicense={doctorLicense}
              compact
              onSaved={onSaved}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notes">
          <AccordionTrigger>
            <span className="flex items-center gap-2 text-slate-700">
              <FileEdit className="h-4 w-4 text-blue-600" />
              Notas
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ClinicalNotesEditor
              appointmentId={appointmentId}
              doctorId={doctorId}
              dataSource={dataSource}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
