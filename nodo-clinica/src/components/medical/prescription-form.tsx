"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, Plus, Trash2, Download, Mail } from "lucide-react";
import { toast } from "sonner";
import type { Medication } from "@/types";
import {
  generatePrescriptionPdf,
  downloadPdf,
  pdfToBase64,
} from "@/lib/pdf/generator";

interface PrescriptionFormProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  patientEmail?: string;
}

const emptyMedication = (): Medication => ({
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
});

export function PrescriptionForm({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  patientEmail,
}: PrescriptionFormProps) {
  const [medications, setMedications] = useState<Medication[]>([
    emptyMedication(),
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string
  ) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med))
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
      });

      downloadPdf(doc, `receta-${patientName.replace(/\s/g, "-")}.pdf`);

      await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          doctorId,
          patientId,
          medications,
        }),
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
        toast.success("Receta enviada por email al paciente");
      } else {
        toast.success("Receta generada correctamente");
      }
    } catch {
      toast.error("Error al generar la receta");
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
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input
                value={med.name}
                onChange={(e) => updateMedication(index, "name", e.target.value)}
                placeholder="Ej: Ibuprofeno 600mg"
                className="h-8 text-sm"
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
            <div className="col-span-2">
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

        <div className="flex gap-2">
          <Button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            className="flex-1 bg-blue-700 hover:bg-blue-800"
            size="sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Descargar PDF
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
