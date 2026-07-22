"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarPlus } from "lucide-react";
import {
  DoctorAssignAppointmentForm,
  type DoctorAssignAppointmentPrefill,
} from "@/components/dashboard/doctor-assign-appointment-form";

export type { DoctorAssignAppointmentPrefill };

interface DoctorAssignAppointmentDialogProps {
  doctorId: string;
  doctorName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: DoctorAssignAppointmentPrefill | null;
  prefillMode?: "consultation" | "search";
  onAssigned?: () => void;
}

export function DoctorAssignAppointmentDialog({
  doctorId,
  doctorName,
  open,
  onOpenChange,
  prefill,
  prefillMode,
  onAssigned,
}: DoctorAssignAppointmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-brand" />
            Asignar turno{doctorName ? ` — Dr/a. ${doctorName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <DoctorAssignAppointmentForm
          doctorId={doctorId}
          active={open}
          prefill={prefill}
          prefillMode={prefillMode}
          onAssigned={onAssigned}
          onSuccessClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
