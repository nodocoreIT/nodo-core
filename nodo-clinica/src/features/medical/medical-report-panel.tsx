import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea } from "@nodocore/shared-components";
import { Badge } from "@/shared/components/ui/badge";
import {
  FileText,
  Mic,
  MicOff,
  Sparkles,
  Mail,
  MessageCircle,
  Loader2,
  Save,
  Download,
} from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { useSpeechTranscription } from "@/hooks/use-speech-transcription";
import { generateClinicalReport } from "@/shared/lib/ai/gemini";
import { supabase } from "@/shared/lib/supabase";
import { toast } from "sonner";

interface MedicalReportPanelProps {
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  compact?: boolean;
  onSaved?: () => void;
  onClose?: () => void;
}

export function MedicalReportPanel({
  appointmentId,
  patientId,
  patientName,
  patientEmail,
  patientPhone,
  doctorId,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  compact = false,
  onSaved,
  onClose,
}: MedicalReportPanelProps) {
  const { transcriptionText, clinicalNotes } = useConsultationStore();
  const [dictation, setDictation] = useState("");
  const [report, setReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useSpeechTranscription({
    enabled: isRecording,
    onSegment: (seg) =>
      setDictation((prev) => (prev ? `${prev}\n${seg.text}` : seg.text)),
  });

  useEffect(() => {
    if (prefilled || !transcriptionText) return;
    setDictation((prev) =>
      prev ? prev : `Transcripción de consulta:\n${transcriptionText}`
    );
    setPrefilled(true);
  }, [transcriptionText, prefilled]);

  const handleGenerate = async () => {
    const source = [dictation, transcriptionText, clinicalNotes]
      .filter(Boolean)
      .join("\n\n");
    if (!source.trim()) {
      toast.error("Dictá o escribí contenido clínico primero");
      return;
    }
    setIsGenerating(true);
    try {
      const text = await generateClinicalReport({
        dictation,
        transcription: transcriptionText,
        clinicalNotes,
        patientName,
        doctorName,
        doctorSpecialty,
        doctorLicense,
      });
      setReport(text);
      toast.success("Informe generado con IA — podés editarlo antes de guardar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar informe");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!report.trim()) {
      toast.error("Generá o escribí el informe primero");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("clinical_records").insert({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_id: appointmentId ?? null,
        record_type: "informe",
        title: `Informe clínico — ${patientName} — ${new Date().toLocaleDateString("es-AR")}`,
        content: report,
      });
      if (error) throw new Error(error.message);
      toast.success("Informe guardado en el historial del paciente");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-${patientName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = () => {
    if (!patientEmail || !report) {
      toast.error("Falta email del paciente o informe generado");
      return;
    }
    toast.success(`Informe listo para enviar a ${patientEmail}`);
  };

  const handleSendWhatsApp = () => {
    if (!report) {
      toast.error("Generá el informe primero");
      return;
    }
    const phone = patientPhone?.replace(/\D/g, "") ?? "";
    const text = encodeURIComponent(
      `Informe médico — ${patientName}\n\n${report.slice(0, 500)}...`
    );
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const inner = (
    <div className="space-y-3">
      <Textarea
        value={dictation}
        onChange={(e) => setDictation(e.target.value)}
        placeholder="Dictá o escribí: motivo de consulta, hallazgos, diagnóstico, plan de tratamiento..."
        className={`text-sm ${compact ? "min-h-[90px]" : "min-h-[120px]"}`}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsRecording(!isRecording)}
          className={isRecording ? "border-red-300 text-red-600 bg-red-50" : ""}
        >
          {isRecording ? (
            <>
              <MicOff className="h-4 w-4 mr-1" />
              Detener dictado
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-1" />
              Dictar por micrófono
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="bg-violet-700 hover:bg-violet-800 flex-1 min-w-[140px]"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1" />
              Generar informe con IA
            </>
          )}
        </Button>
      </div>
      {isRecording && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Escuchando… hablá con naturalidad como en una consulta
        </p>
      )}

      {(report || isGenerating) && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600">
              Informe generado — editable
            </p>
            {clinicalNotes && (
              <Badge variant="outline" className="text-[10px]">
                Incluye notas clínicas
              </Badge>
            )}
          </div>
          <Textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="El informe aparecerá aquí. Podés editarlo libremente."
            className={`text-sm ${compact ? "min-h-[160px]" : "min-h-[220px]"}`}
            disabled={isGenerating}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !report.trim()}
              className="bg-blue-700 hover:bg-blue-800 flex-1 min-w-[120px]"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Guardar en historial
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!report.trim()}
            >
              <Download className="h-4 w-4 mr-1" />
              Descargar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={handleSendEmail}
              disabled={!patientEmail || !report.trim()}
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[120px] border-emerald-200 text-emerald-700"
              onClick={handleSendWhatsApp}
              disabled={!report.trim()}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {onClose && (
          <Button variant="ghost" size="sm" className="h-8 text-xs -ml-2" onClick={onClose}>
            ← Volver a la ficha del paciente
          </Button>
        )}
        {inner}
      </div>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-600" />
          Informe clínico con IA
          <Badge variant="outline" className="ml-auto text-xs border-violet-200">
            <Sparkles className="h-3 w-3 mr-1" />
            Dictado + IA
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{inner}</CardContent>
    </Card>
  );
}
