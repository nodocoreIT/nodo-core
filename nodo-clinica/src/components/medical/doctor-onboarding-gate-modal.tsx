"use client";

import { CalendarClock, ClipboardList, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type OnboardingGateKind = "ambos" | "honorarios" | "agenda";

const GATE_COPY: Record<
  OnboardingGateKind,
  { icon: React.ElementType; title: string; description: string; cta: string }
> = {
  ambos: {
    icon: ClipboardList,
    title: "Configurá tu consultorio",
    description:
      "Antes de recibir turnos definí tus honorarios y tus horarios de agenda.",
    cta: "Empezar",
  },
  honorarios: {
    icon: Wallet,
    title: "Configurá tus honorarios",
    description:
      "Antes de recibir turnos necesitás definir el valor de tu consulta y tus datos de cobro.",
    cta: "Configurar honorarios",
  },
  agenda: {
    icon: CalendarClock,
    title: "Configurá tu agenda",
    description:
      "Antes de recibir turnos necesitás definir tus días y horarios de atención.",
    cta: "Configurar agenda",
  },
};

interface DoctorOnboardingGateModalProps {
  kind: OnboardingGateKind;
  open: boolean;
  onContinue: () => void;
}

export function DoctorOnboardingGateModal({
  kind,
  open,
  onContinue,
}: DoctorOnboardingGateModalProps) {
  const copy = GATE_COPY[kind];
  const Icon = copy.icon;

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
          <DialogDescription className="text-center">{copy.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button type="button" className="w-full sm:w-auto" onClick={onContinue}>
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
