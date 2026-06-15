import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@nodocore/shared-components";
import { MedicalReportPanel } from "./medical-report-panel";

interface ClinicalReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  onSaved?: () => void;
}

export function ClinicalReportDialog({
  open,
  onOpenChange,
  onSaved,
  ...panelProps
}: ClinicalReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar informe clínico</DialogTitle>
          <DialogDescription>
            Dictá o escribí lo relevante del paciente. La IA redactará el informe
            y podrás editarlo antes de guardarlo.
          </DialogDescription>
        </DialogHeader>
        <MedicalReportPanel
          {...panelProps}
          compact
          onSaved={() => {
            onSaved?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
