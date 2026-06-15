import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@nodocore/shared-components";
import { FlaskConical, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { saveStudyOrder } from "@/shared/lib/api/clinical";
import { formatDate } from "@/shared/lib/utils";

interface StudyRequestFormProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
}

export function StudyRequestForm({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
}: StudyRequestFormProps) {
  const [studies, setStudies] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const updateStudy = (index: number, value: string) => {
    setStudies((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addStudy = () => setStudies((prev) => [...prev, ""]);
  const removeStudy = (index: number) =>
    setStudies((prev) => prev.filter((_, i) => i !== index));

  const generatePdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PEDIDO DE ESTUDIOS", 105, 20, { align: "center" });

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
    doc.setFont("helvetica", "bold");
    doc.text("Estudios solicitados:", 20, y);
    doc.setFont("helvetica", "normal");
    y += 8;

    studies.filter(Boolean).forEach((study, i) => {
      doc.text(`${i + 1}. ${study}`, 20, y);
      y += 7;
    });

    if (notes) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Indicaciones:", 20, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      const lines = doc.splitTextToSize(notes, 170) as string[];
      doc.text(lines, 20, y);
    }

    return doc;
  };

  const handleGenerate = async () => {
    const validStudies = studies.filter(Boolean);
    if (validStudies.length === 0) {
      toast.error("Agregue al menos un estudio");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = generatePdf();
      doc.save(`estudios-${patientName.replace(/\s/g, "-")}.pdf`);

      await saveStudyOrder({
        appointmentId,
        doctorId,
        patientId,
        studies: validStudies,
        notes: notes || undefined,
      });

      toast.success("Pedido de estudios generado y guardado");
    } catch {
      toast.error("Error al generar el pedido de estudios");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <FlaskConical className="h-4 w-4 text-brand" />
          Pedido de Estudios
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          {studies.map((study, index) => (
            <div key={index} className="flex gap-2 items-center">
              <div className="flex-1">
                <Label className="text-xs sr-only">Estudio {index + 1}</Label>
                <Input
                  value={study}
                  onChange={(e) => updateStudy(index, e.target.value)}
                  placeholder={`Ej: Hemograma completo`}
                  className="h-8 text-sm"
                />
              </div>
              {studies.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStudy(index)}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addStudy}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar estudio
        </Button>

        <div>
          <Label className="text-xs">Indicaciones adicionales</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ayuno de 8 horas, urgente, etc."
            className="text-sm resize-none"
            rows={3}
          />
        </div>

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
