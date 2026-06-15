import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from "@nodocore/shared-components";
import { Pill, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { savePrescription } from "@/shared/lib/api/clinical";
import type { Medication } from "@/types";
import { formatDate } from "@/shared/lib/utils";

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
}: PrescriptionFormProps) {
  const [medications, setMedications] = useState<Medication[]>([
    emptyMedication(),
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string,
  ) => {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)),
    );
  };

  const addMedication = () =>
    setMedications((prev) => [...prev, emptyMedication()]);

  const removeMedication = (index: number) =>
    setMedications((prev) => prev.filter((_, i) => i !== index));

  const generatePdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RECETA MÉDICA", 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Dr/a. ${doctorName}`, 20, 35);
    if (doctorSpecialty) doc.text(doctorSpecialty, 20, 41);
    if (doctorLicense) doc.text(`Mat. ${doctorLicense}`, 20, 47);

    doc.line(20, 52, 190, 52);

    doc.setFont("helvetica", "bold");
    doc.text(`Paciente: ${patientName}`, 20, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${formatDate(new Date())}`, 20, 66);

    doc.line(20, 71, 190, 71);

    let y = 80;
    medications.forEach((med, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${med.name}`, 20, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      doc.text(`   Dosis: ${med.dosage}  |  Frecuencia: ${med.frequency}  |  Duración: ${med.duration}`, 20, y);
      if (med.instructions) {
        y += 5;
        doc.text(`   Indicaciones: ${med.instructions}`, 20, y);
      }
      y += 8;
    });

    return doc;
  };

  const handleGenerate = async () => {
    const valid = medications.every((m) => m.name && m.dosage);
    if (!valid) {
      toast.error("Complete al menos nombre y dosis de cada medicamento");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = generatePdf();
      doc.save(`receta-${patientName.replace(/\s/g, "-")}.pdf`);

      await savePrescription({
        appointmentId,
        doctorId,
        patientId,
        medications,
      });

      toast.success("Receta generada y guardada");
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
          <Pill className="h-4 w-4 text-brand" />
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
                onChange={(e) =>
                  updateMedication(index, "dosage", e.target.value)
                }
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
                value={med.instructions ?? ""}
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

        <Button
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="w-full bg-brand hover:bg-brand-600"
          size="sm"
        >
          <Download className="h-4 w-4 mr-1" />
          Descargar PDF
        </Button>
      </CardContent>
    </Card>
  );
}
