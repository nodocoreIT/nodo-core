"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, Plus, Trash2, Download, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import type { Medication } from "@/types";
import {
  generatePrescriptionPdf,
  downloadPdf,
  pdfToBase64,
} from "@/lib/pdf/generator";
import { clinicApi } from "@/lib/clinic/client-api";
import type { MedicationCatalogEntry } from "@/lib/clinic/medication-catalog";

interface PrescriptionFormProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  patientEmail?: string;
  onSaved?: () => void;
}

const emptyMedication = (): Medication => ({
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
});

function MedicationNameField({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (entry: MedicationCatalogEntry) => void;
}) {
  const [suggestions, setSuggestions] = useState<MedicationCatalogEntry[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await clinicApi.searchMedications(q);
      setSuggestions(data.results);
      setOpen(data.results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  return (
    <div className="relative">
      <Label className="text-xs">Nombre (Vademécum)</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            void search(e.target.value);
          }}
          onFocus={() => value.length >= 2 && void search(value)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar medicamento…"
          className="h-8 text-sm pl-8"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-white shadow-lg text-sm">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-blue-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-slate-500 ml-1 block">
                  {s.activeIngredient}
                  {s.laboratorio ? ` · ${s.laboratorio}` : ""}
                  {s.precio
                    ? ` · $${s.precio.toLocaleString("es-AR")}`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PrescriptionForm({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  patientEmail,
  onSaved,
}: PrescriptionFormProps) {
  const [medications, setMedications] = useState<Medication[]>([emptyMedication()]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageData, setSignatureImageData] = useState("");

  useEffect(() => {
    clinicApi.getDoctorSchedule(doctorId).then((data) => {
      if (data.signatureText) setSignatureText(data.signatureText);
      if (data.signatureImageData) setSignatureImageData(data.signatureImageData);
    }).catch(() => undefined);
  }, []);

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string,
  ) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)),
    );
  };

  const applyCatalogEntry = (index: number, entry: MedicationCatalogEntry) => {
    setMedications((prev) =>
      prev.map((med, i) =>
        i === index
          ? {
              ...med,
              name: entry.name,
              dosage: entry.defaultDosage,
              frequency: entry.defaultFrequency,
              duration: entry.defaultDuration,
            }
          : med,
      ),
    );
  };

  const addMedication = () =>
    setMedications((prev) => [...prev, emptyMedication()]);

  const removeMedication = (index: number) =>
    setMedications((prev) => prev.filter((_, i) => i !== index));

  const handleGenerate = async (sendEmail = false) => {
    const valid = medications.every((m) => m.name && m.dosage);
    if (!valid) {
      toast.error("Complete al menos nombre y dosis de cada medicamento");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = generatePrescriptionPdf({
        doctor: {
          full_name: doctorName,
          specialty: doctorSpecialty,
          license_number: doctorLicense,
        },
        patientName,
        medications,
        signatureText: signatureText || `Dr/a. ${doctorName}`,
        signatureImageData,
      });

      downloadPdf(doc, `receta-${patientName.replace(/\s/g, "-")}.pdf`);

      await clinicApi.savePrescription({
        appointmentId,
        doctorId,
        patientId,
        medications,
        pdfBase64: pdfToBase64(doc),
      });

      if (sendEmail && patientEmail) {
        await fetch("/api/prescriptions/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientEmail,
            patientName,
            doctorName,
            pdfBase64: pdfToBase64(doc),
          }),
        });
        toast.success("Receta guardada en historial y enviada por email");
      } else {
        toast.success("Receta guardada en historial clínico del paciente");
      }
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar la receta");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Pill className="h-4 w-4 text-blue-600" />
          Recetario Digital
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {medications.map((med, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
          >
            <div className="col-span-2 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">
                Medicamento {index + 1}
              </span>
              {medications.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMedication(index)}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="col-span-2">
              <MedicationNameField
                value={med.name}
                onChange={(v) => updateMedication(index, "name", v)}
                onPick={(entry) => applyCatalogEntry(index, entry)}
              />
            </div>
            <div>
              <Label className="text-xs">Dosis</Label>
              <Input
                value={med.dosage}
                onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                placeholder="1 comprimido"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Frecuencia</Label>
              <Input
                value={med.frequency}
                onChange={(e) =>
                  updateMedication(index, "frequency", e.target.value)
                }
                placeholder="Cada 8 horas"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Duración</Label>
              <Input
                value={med.duration}
                onChange={(e) =>
                  updateMedication(index, "duration", e.target.value)
                }
                placeholder="7 días"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Indicaciones</Label>
              <Input
                value={med.instructions || ""}
                onChange={(e) =>
                  updateMedication(index, "instructions", e.target.value)
                }
                placeholder="Tomar con alimentos"
                className="h-8 text-sm"
              />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addMedication}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar medicamento
        </Button>

        {!signatureText && (
          <p className="text-xs text-amber-700">
            Configurá tu firma en Consultorio → Perfil para que aparezca en recetas y órdenes.
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            className="flex-1 bg-blue-700 hover:bg-blue-800"
            size="sm"
          >
            <Download className="h-4 w-4 mr-1" />
            PDF + historial
          </Button>
          {patientEmail && (
            <Button
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Mail className="h-4 w-4 mr-1" />
              Enviar por email
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
