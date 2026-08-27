"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Phone, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import type { DoctorAvailability } from "@/lib/clinic/schedule";

interface PresencialSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface InPersonAvailability {
  enabled: boolean;
  availability: DoctorAvailability;
  location_info: {
    address: string;
    phone: string;
    parkingNotes?: string;
  };
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function AgendaPresencialSection({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [parkingNotes, setParkingNotes] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [slots, setSlots] = useState<PresencialSlot[]>([
    { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" },
    { dayOfWeek: 1, startTime: "16:00", endTime: "19:00" },
    { dayOfWeek: 2, startTime: "09:00", endTime: "13:00" },
  ]);
  const [saving, setSaving] = useState(false);

  const handleAddSlot = () => {
    setSlots([...slots, { dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }]);
  };

  const handleRemoveSlot = (idx: number) => {
    setSlots(slots.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (enabled && !address) {
      toast.error("Ingresá la dirección de atención");
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
        location_info: enabled ? { address, phone, parkingNotes } : {},
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
                Dirección
              </label>
              <Input
                placeholder="Ej: Av. Corrientes 1234, CABA"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Duración del turno</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="h-8 rounded border border-slate-200 px-2 text-sm"
              >
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>1 hora</option>
              </select>
            </div>

            <div className="space-y-2">
              {slots.map((slot, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => {
                      const newSlots = [...slots];
                      newSlots[idx].dayOfWeek = Number(e.target.value);
                      setSlots(newSlots);
                    }}
                    className="h-9 rounded border border-slate-200 px-2 text-sm flex-1"
                  >
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => {
                      const newSlots = [...slots];
                      newSlots[idx].startTime = e.target.value;
                      setSlots(newSlots);
                    }}
                    className="h-9 rounded border border-slate-200 px-2 text-sm flex-1"
                  />

                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => {
                      const newSlots = [...slots];
                      newSlots[idx].endTime = e.target.value;
                      setSlots(newSlots);
                    }}
                    className="h-9 rounded border border-slate-200 px-2 text-sm flex-1"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveSlot(idx)}
                  >
                    −
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSlot}
              className="w-full"
            >
              + Agregar horario
            </Button>
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
