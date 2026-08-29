"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Phone, Info, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { clinicApi, type InstitutionRecord } from "@/lib/clinic/client-api";
import { dayLabel } from "@/lib/clinic/schedule";

function institutionLabel(inst: InstitutionRecord): string {
  return inst.city ? `${inst.name} — ${inst.city}` : inst.name;
}

function scheduleSummary(inst: InstitutionRecord): string {
  const days = inst.schedule?.days ?? [];
  if (days.length === 0) return "Sin horarios cargados";
  return days
    .map((d) => `${dayLabel(d.dayOfWeek)} ${d.startTime}-${d.endTime}`)
    .join(" · ");
}

/** "Turnos Presenciales" — global on/off + contact info shared across all of
 * the doctor's institutions. Each institution owns its own weekly schedule
 * (managed in Instituciones); this section only shows a read-only summary,
 * so there's a single source of truth instead of two competing editors. */
export function AgendaPresencialSection({
  onSaved,
  onGoToInstituciones,
}: {
  onSaved?: () => void;
  onGoToInstituciones?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [parkingNotes, setParkingNotes] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([clinicApi.getInstitutions(), clinicApi.getInPersonAvailability()])
      .then(([institutionsRes, availabilityRes]) => {
        if (!active) return;
        setInstitutions(institutionsRes.institutions.filter((i) => i.active));
        setEnabled(availabilityRes.enabled);
        setPhone(availabilityRes.location_info?.phone ?? "");
        setParkingNotes(availabilityRes.location_info?.parkingNotes ?? "");
        if (availabilityRes.availability?.slotDurationMinutes) {
          setSlotDuration(availabilityRes.availability.slotDurationMinutes);
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "No se pudo cargar la agenda presencial",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (enabled && institutions.length === 0) {
      toast.error("Cargá al menos una institución para atender de forma presencial");
      return;
    }

    if (enabled && !phone) {
      toast.error("Ingresá el teléfono de contacto");
      return;
    }

    setSaving(true);
    try {
      await clinicApi.saveInPersonAvailability({
        enabled,
        availability: {
          slotDurationMinutes: slotDuration,
          days: [],
        },
        location_info: enabled ? { phone, parkingNotes } : {},
      });
      toast.success("Agenda presencial guardada");
      onSaved?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar la agenda"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Checkbox
          id="enable-presencial"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <label
          htmlFor="enable-presencial"
          className="text-sm font-medium cursor-pointer"
        >
          Atendés pacientes de forma presencial
        </label>
      </div>

      {enabled && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Instituciones</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGoToInstituciones}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {institutions.length === 0 ? "Agregar institución" : "Editar horarios"}
              </Button>
            </div>

            {institutions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Todavía no cargaste ninguna institución.
              </p>
            ) : (
              <div className="space-y-2">
                {institutions.map((inst) => (
                  <div
                    key={inst.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {institutionLabel(inst)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {scheduleSummary(inst)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">
                <Phone className="inline h-4 w-4 mr-1" />
                Teléfono
              </label>
              <Input
                placeholder="Ej: +54 11 4555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Notas de estacionamiento
              </label>
              <Input
                placeholder="Ej: Subsuelo, código en recepción"
                value={parkingNotes}
                onChange={(e) => setParkingNotes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Duración de cada turno</Label>
            <Select
              value={String(slotDuration)}
              onValueChange={(v) => setSlotDuration(Number(v))}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 20, 30, 45, 60].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Los días y horarios se cargan por institución en la pestaña
              Instituciones. El paciente ve los horarios libres de cada una
              según el día que elija — no hace falta elegir una institución
              principal acá.
            </p>
          </div>
        </>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-emerald-700 hover:bg-emerald-800"
      >
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Guardar cambios
      </Button>
    </div>
  );
}
