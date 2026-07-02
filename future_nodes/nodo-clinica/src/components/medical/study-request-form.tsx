"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Search, Download, Check, Plus } from "lucide-react";
import { MEDICAL_EXAMS } from "@/lib/constants";
import {
  generateStudyOrderPdf,
  downloadPdf,
  pdfToBase64,
} from "@/lib/pdf/generator";
import { clinicApi } from "@/lib/clinic/client-api";
import { toast } from "sonner";

interface StudyRequestFormProps {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  onSaved?: () => void;
}

type ExamOption = { id: string; name: string; category: string };

export function StudyRequestForm({
  appointmentId,
  doctorId,
  patientId,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  onSaved,
}: StudyRequestFormProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageData, setSignatureImageData] = useState("");
  const [customLabels, setCustomLabels] = useState<string[]>([]);

  useEffect(() => {
    clinicApi
      .getDoctorSchedule(doctorId)
      .then((data) => {
        if (data.signatureText) setSignatureText(data.signatureText);
        if (data.signatureImageData) setSignatureImageData(data.signatureImageData);
        if (Array.isArray(data.customStudyLabels)) {
          setCustomLabels(data.customStudyLabels);
        }
      })
      .catch(() => undefined);
  }, [doctorId]);

  const allExams = useMemo((): ExamOption[] => {
    const base = MEDICAL_EXAMS.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
    }));
    const custom = customLabels
      .filter((name) => !base.some((e) => e.name.toLowerCase() === name.toLowerCase()))
      .map((name, i) => ({
        id: `custom-${i}-${name}`,
        name,
        category: "Mis estudios",
      }));
    return [...custom, ...base];
  }, [customLabels]);

  const filteredExams = useMemo(() => {
    if (!search.trim()) return allExams;
    const q = search.toLowerCase();
    return allExams.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    );
  }, [search, allExams]);

  const canAddCustom =
    search.trim().length >= 3 &&
    !allExams.some((e) => e.name.toLowerCase() === search.trim().toLowerCase());

  const toggleExam = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const addCustomStudy = () => {
    const label = search.trim();
    if (!label) return;
    if (!selected.includes(label)) {
      setSelected((prev) => [...prev, label]);
    }
    if (!customLabels.some((c) => c.toLowerCase() === label.toLowerCase())) {
      setCustomLabels((prev) => [...prev, label]);
    }
    setSearch("");
  };

  const handleGenerate = async () => {
    if (selected.length === 0) {
      toast.error("Seleccione al menos un estudio");
      return;
    }

    setIsGenerating(true);
    try {
      const doc = generateStudyOrderPdf({
        doctor: {
          full_name: doctorName,
          specialty: doctorSpecialty,
          license_number: doctorLicense,
        },
        patientName,
        studies: selected,
        notes: notes || undefined,
        signatureText: signatureText || `Dr/a. ${doctorName}`,
        signatureImageData,
      });

      downloadPdf(doc, `orden-estudios-${patientName.replace(/\s/g, "-")}.pdf`);

      const newStudyLabels = selected.filter(
        (s) =>
          !MEDICAL_EXAMS.some((e) => e.name.toLowerCase() === s.toLowerCase()) &&
          !customLabels.some((c) => c.toLowerCase() === s.toLowerCase()),
      );

      await clinicApi.saveStudyOrder({
        appointmentId,
        doctorId,
        patientId,
        studies: selected,
        notes,
        pdfBase64: pdfToBase64(doc),
        newStudyLabels: newStudyLabels.length ? newStudyLabels : undefined,
      });

      if (newStudyLabels.length) {
        setCustomLabels((prev) => [...new Set([...prev, ...newStudyLabels])]);
      }

      toast.success("Orden guardada en historial clínico del paciente");
      onSaved?.();
    } catch {
      toast.error("Error al generar la orden");
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [...new Set(filteredExams.map((e) => e.category))];

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <FlaskConical className="h-4 w-4 text-blue-600" />
          Solicitud de Estudios
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar exámenes..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        {canAddCustom && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed text-xs"
            onClick={addCustomStudy}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Agregar &quot;{search.trim()}&quot; a la lista
          </Button>
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <Badge
                key={s}
                className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer text-xs"
                onClick={() => toggleExam(s)}
              >
                {s} ×
              </Badge>
            ))}
          </div>
        )}

        <div className="max-h-[200px] overflow-y-auto space-y-3 pr-1">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-medium text-slate-400 mb-1.5">{cat}</p>
              <div className="space-y-1">
                {filteredExams
                  .filter((e) => e.category === cat)
                  .map((exam) => {
                    const isSelected = selected.includes(exam.name);
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => toggleExam(exam.name)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "hover:bg-slate-50 text-slate-700 border border-transparent"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        {exam.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs">Observaciones</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Indicaciones adicionales para el laboratorio..."
            className="text-sm min-h-[60px] resize-none"
          />
        </div>

        {!signatureText && !signatureImageData && (
          <p className="text-xs text-amber-700">
            Configurá tu firma en Consultorio → Perfil para que aparezca en documentos PDF.
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selected.length === 0}
          className="w-full bg-blue-700 hover:bg-blue-800"
          size="sm"
        >
          <Download className="h-4 w-4 mr-1" />
          PDF + historial ({selected.length})
        </Button>
      </CardContent>
    </Card>
  );
}
