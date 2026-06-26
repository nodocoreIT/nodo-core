"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import {
  dayLabel,
  DEFAULT_AVAILABILITY,
  normalizeAvailability,
  type DaySchedule,
  type DoctorAvailability,
} from "@/lib/clinic/schedule";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

interface DoctorSchedulePanelProps {
  doctorId: string;
}

export function DoctorSchedulePanel({ doctorId }: DoctorSchedulePanelProps) {
  const [availability, setAvailability] =
    useState<DoctorAvailability>(DEFAULT_AVAILABILITY);
  const [signatureText, setSignatureText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clinicApi.getDoctorSchedule(doctorId).then((data) => {
      if (data.availability) {
        setAvailability(normalizeAvailability(data.availability));
      }
      if (data.signatureText) setSignatureText(data.signatureText);
    });
  }, [doctorId]);

  const toggleDay = (dayOfWeek: number) => {
    setAvailability((prev) => {
      const exists = prev.days.some((d) => d.dayOfWeek === dayOfWeek);
      if (exists) {
        return {
          ...prev,
          days: prev.days.filter((d) => d.dayOfWeek !== dayOfWeek),
        };
      }
      return {
        ...prev,
        days: [
          ...prev.days,
          { dayOfWeek, startTime: "09:00", endTime: "13:00" },
        ].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      };
    });
  };

  const updateDayTime = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await clinicApi.saveSchedule({ availability, signatureText });
      toast.success("Agenda y firma guardadas");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-blue-600" />
          Mi Agenda — Días y horarios
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div>
          <Label className="text-xs">Duración de cada turno</Label>
          <Select
            value={String(availability.slotDurationMinutes)}
            onValueChange={(v) =>
              setAvailability((prev) => ({
                ...prev,
                slotDurationMinutes: Number(v),
              }))
            }
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[15, 20, 30, 45, 60].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} minutos
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Días que atiendo</Label>
          {ALL_DAYS.map((dow) => {
            const active = availability.days.some((d) => d.dayOfWeek === dow);
            const day = availability.days.find((d) => d.dayOfWeek === dow);
            return (
              <div
                key={dow}
                className={`rounded-lg border p-2.5 ${
                  active ? "border-blue-200 bg-blue-50/30" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleDay(dow)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">{dayLabel(dow)}</span>
                </div>
                {active && day && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div>
                      <Label className="text-[10px] text-slate-400">Desde</Label>
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateDayTime(dow, "startTime", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-400">Hasta</Label>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateDayTime(dow, "endTime", e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <Label className="text-xs">Firma en documentos (informes y recetas)</Label>
          <Input
            value={signatureText}
            onChange={(e) => setSignatureText(e.target.value)}
            placeholder="Dr. Nombre — Mat. 12345"
            className="mt-1 h-9 text-sm"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-700 hover:bg-blue-800"
          size="sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Guardar agenda
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
