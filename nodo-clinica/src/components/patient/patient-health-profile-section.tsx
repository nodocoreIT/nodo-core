"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeartPulse, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";
import type { PatientHealthProfile } from "@/lib/clinic/local-db";

const EMPTY: PatientHealthProfile = {
  sex: "",
  bloodType: "",
};

export function PatientHealthProfileSection({
  initialProfile,
  onSaved,
}: {
  initialProfile?: PatientHealthProfile | null;
  onSaved?: (profile: PatientHealthProfile) => void;
}) {
  const [profile, setProfile] = useState<PatientHealthProfile>({
    ...EMPTY,
    ...initialProfile,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile({ ...EMPTY, ...initialProfile });
  }, [initialProfile]);

  const setField = <K extends keyof PatientHealthProfile>(
    key: K,
    value: PatientHealthProfile[K],
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await clinicApi.updatePatientProfile({
        healthProfile: {
          ...profile,
          heightCm: profile.heightCm
            ? Number(profile.heightCm)
            : undefined,
          weightKg: profile.weightKg
            ? Number(profile.weightKg)
            : undefined,
        },
      });
      onSaved?.(saved.healthProfile ?? profile);
      toast.success("Ficha de salud guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const bmi =
    profile.heightCm && profile.weightKg
      ? (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)
      : null;

  return (
    <Card className="border-emerald-100 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-slate-800">
          <HeartPulse className="h-5 w-5 text-emerald-600" />
          Mi ficha de salud
        </CardTitle>
        <p className="text-xs text-slate-500">
          Completá tus datos una vez. Al pedir turno podés autorizar al médico a
          ver esta información.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Fecha de nacimiento</Label>
            <Input
              type="date"
              className="mt-1 h-9"
              value={profile.birthDate ?? ""}
              onChange={(e) => setField("birthDate", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Sexo</Label>
            <Select
              value={profile.sex ?? ""}
              onValueChange={(v) =>
                setField("sex", v as PatientHealthProfile["sex"])
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Femenino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="O">Otro / prefiero no decir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Altura (cm)</Label>
            <Input
              type="number"
              className="mt-1 h-9"
              placeholder="170"
              value={profile.heightCm ?? ""}
              onChange={(e) =>
                setField(
                  "heightCm",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </div>
          <div>
            <Label className="text-xs">Peso (kg)</Label>
            <Input
              type="number"
              className="mt-1 h-9"
              placeholder="70"
              value={profile.weightKg ?? ""}
              onChange={(e) =>
                setField(
                  "weightKg",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            />
          </div>
          <div>
            <Label className="text-xs">Grupo sanguíneo</Label>
            <Input
              className="mt-1 h-9"
              placeholder="Ej. O+"
              value={profile.bloodType ?? ""}
              onChange={(e) => setField("bloodType", e.target.value)}
            />
          </div>
          {bmi && (
            <div className="flex items-end">
              <p className="text-xs text-slate-500 pb-2">
                IMC calculado: <span className="font-medium">{bmi}</span>
              </p>
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs">Alergias</Label>
          <Textarea
            className="mt-1 text-sm min-h-[60px]"
            placeholder="Medicamentos, alimentos..."
            value={profile.allergies ?? ""}
            onChange={(e) => setField("allergies", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Enfermedades crónicas / antecedentes</Label>
          <Textarea
            className="mt-1 text-sm min-h-[60px]"
            value={profile.chronicConditions ?? ""}
            onChange={(e) => setField("chronicConditions", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Medicación habitual</Label>
          <Textarea
            className="mt-1 text-sm min-h-[50px]"
            value={profile.medications ?? ""}
            onChange={(e) => setField("medications", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Contacto de emergencia</Label>
          <Input
            className="mt-1 h-9"
            placeholder="Nombre y teléfono"
            value={profile.emergencyContact ?? ""}
            onChange={(e) => setField("emergencyContact", e.target.value)}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-700 hover:bg-emerald-800"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Guardar ficha
        </Button>
      </CardContent>
    </Card>
  );
}
