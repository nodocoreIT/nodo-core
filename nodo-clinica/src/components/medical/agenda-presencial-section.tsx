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
import { WeeklyScheduleEditor } from "@/components/medical/weekly-schedule-editor";
import { MapPin, Phone, AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { clinicApi, type InstitutionRecord } from "@/lib/clinic/client-api";
import type { DaySchedule } from "@/lib/clinic/schedule";

function institutionLabel(inst: InstitutionRecord): string {
  return inst.city ? `${inst.name} — ${inst.city}` : inst.name;
}

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
  const [institutionId, setInstitutionId] = useState("");
  const [phone, setPhone] = useState("");
  const [parkingNotes, setParkingNotes] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [slots, setSlots] = useState<DaySchedule[]>([
    { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 1, startTime: "16:00", endTime: "19:00" },
    { dayOfWeek: 2, startTime: "09:00", endTime: "13:00" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([clinicApi.getInstitutions(), clinicApi.getInPersonAvailability()])
      .then(([institutionsRes, availabilityRes]) => {
        if (!active) return;
        setInstitutions(institutionsRes.institutions.filter((i) => i.active));
        setEnabled(availabilityRes.enabled);
        setInstitutionId(availabilityRes.institution_id ?? "");
        setPhone(availabilityRes.location_info?.phone ?? "");
        setParkingNotes(availabilityRes.location_info?.parkingNotes ?? "");
        if (availabilityRes.availability?.slotDurationMinutes) {
          setSlotDuration(availabilityRes.availability.slotDurationMinutes);
        }
        if (availabilityRes.availability?.days?.length) {
          setSlots(
            availabilityRes.availability.days,
          );
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

  const selectedInstitution = institutions.find((i) => i.id === institutionId);

  const handleSave = async () => {
    if (enabled && !institutionId) {
      toast.error("Elegí la institución donde atendés de forma presencial");
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
          days: enabled ? slots : [],
        },
        location_info: enabled
          ? {
              address: selectedInstitution
                ? [selectedInstitution.address, selectedInstitution.city]
                    .filter(Boolean)
                    .join(", ")
                : "",
              phone,
              parkingNotes,
            }
          : {},
        institution_id: enabled ? institutionId || null : null,
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
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                Institución
              </label>
              {institutions.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Todavía no cargaste ninguna institución.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGoToInstituciones}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar institución
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    className="h-9 flex-1 rounded border border-slate-200 px-2 text-sm bg-white"
                  >
                    <option value="">Seleccioná una institución…</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {institutionLabel(inst)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onGoToInstituciones}
                    className="gap-1 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar institución
                  </Button>
                </div>
              )}
              {selectedInstitution?.address && (
                <p className="text-xs text-slate-400 mt-1">
                  {[selectedInstitution.address, selectedInstitution.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>

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

          <div className="space-y-2">
            <Label className="text-xs">Días y horarios</Label>
            <WeeklyScheduleEditor days={slots} onChange={setSlots} />
          </div>

          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Los turnos presenciales no pueden chocar con tus turnos virtuales.
              La validación es automática.
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
