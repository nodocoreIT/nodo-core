"use client";

import { useEffect, useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clinicApi } from "@/lib/clinic/client-api";
import { isUnassignedSpecialty } from "@/lib/clinic/unassigned-specialty";

interface SpecialtyOption {
  id: string;
  name: string;
}

interface DoctorSpecialtySetupModalProps {
  open: boolean;
  onComplete: (specialty: string) => void;
}

export function DoctorSpecialtySetupModal({
  open,
  onComplete,
}: DoctorSpecialtySetupModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setSelected("");

    fetch("/api/clinic/specialties")
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las especialidades");
        const data = await res.json();
        const items = (data.specialties ?? []) as SpecialtyOption[];
        if (!cancelled) {
          setSpecialties(
            items.filter((item) => item.name && !isUnassignedSpecialty(item.name)),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Error al cargar especialidades",
          );
          setSpecialties([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleSave() {
    const specialty = selected.trim();
    if (!specialty || isUnassignedSpecialty(specialty)) {
      toast.error("Seleccioná tu especialidad para continuar.");
      return;
    }

    setSaving(true);
    try {
      await clinicApi.saveDoctorOffice({ specialties: [specialty] });
      toast.success("Especialidad guardada.");
      onComplete(specialty);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la especialidad");
    } finally {
      setSaving(false);
    }
  }

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
            <Stethoscope className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Completá tu perfil médico</DialogTitle>
          <DialogDescription className="text-center">
            Antes de usar el consultorio, indicá la especialidad a la que pertenecés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label htmlFor="doctor-specialty-select" className="text-sm font-medium text-navy">
            Especialidad
          </label>
          {loading ? (
            <div className="flex h-9 items-center justify-center rounded-sm border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : specialties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay especialidades disponibles. Contactá al administrador de la clínica.
            </p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="doctor-specialty-select">
                <SelectValue placeholder="Seleccioná una especialidad" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((item) => (
                  <SelectItem key={item.id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={loading || saving || !selected || specialties.length === 0}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
