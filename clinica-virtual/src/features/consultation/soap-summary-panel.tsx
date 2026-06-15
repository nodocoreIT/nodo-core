import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@nodocore/shared-components";
import { Brain, Loader2, Sparkles, FileEdit, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useConsultationStore } from "@/store/consultation-store";
import { upsertSoapSummary } from "@/shared/lib/api/clinical";
import type { SoapSummary } from "@/types";

interface SoapSummaryPanelProps {
  appointmentId: string;
  doctorId?: string;
  onConsultationEnd?: () => void;
}

function formatSoapAsMarkdown(s: SoapSummary): string {
  return `## Subjetivo\n${s.subjective}\n\n## Objetivo\n${s.objective}\n\n## Análisis\n${s.analysis}\n\n## Plan\n${s.plan}`;
}

export function SoapSummaryPanel({
  appointmentId,
  doctorId,
  onConsultationEnd,
}: SoapSummaryPanelProps) {
  const { transcriptionText, clinicalNotes, setClinicalNotes, setLastSavedAt, requestNotesEditorFocus } =
    useConsultationStore();
  const [summary, setSummary] = useState<SoapSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleGenerate = async () => {
    if (!transcriptionText && !clinicalNotes) {
      toast.error("No hay transcripción ni notas para generar el resumen");
      return;
    }

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!geminiKey) {
      toast.error("VITE_GEMINI_API_KEY no configurada");
      return;
    }

    setIsGenerating(true);
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Eres un asistente médico. Generá un resumen SOAP en español a partir de los siguientes datos de una consulta médica.

TRANSCRIPCIÓN:
${transcriptionText || "(sin transcripción)"}

NOTAS DEL MÉDICO:
${clinicalNotes || "(sin notas)"}

Respondé ÚNICAMENTE con un objeto JSON con las claves: subjective, objective, analysis, plan. Sin markdown, sin texto extra.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Respuesta inesperada de Gemini");

      const parsed = JSON.parse(jsonMatch[0]) as {
        subjective?: string;
        objective?: string;
        analysis?: string;
        plan?: string;
      };

      const soapData: SoapSummary = {
        id: crypto.randomUUID(),
        appointment_id: appointmentId,
        subjective: parsed.subjective ?? "",
        objective: parsed.objective ?? "",
        analysis: parsed.analysis ?? "",
        plan: parsed.plan ?? "",
        created_at: new Date().toISOString(),
      };

      setSummary(soapData);

      // Persist to Supabase
      await upsertSoapSummary(appointmentId, soapData).catch(() => {
        /* non-critical */
      });

      toast.success("Resumen SOAP generado con IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar resumen SOAP");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToNotes = async (mode: "append" | "replace") => {
    if (!summary) return;
    setIsApplying(true);
    try {
      const markdown = formatSoapAsMarkdown(summary);
      const current = clinicalNotes.trim();
      const next =
        mode === "replace" || !current
          ? markdown
          : `${current}\n\n---\n\n${markdown}`;

      setClinicalNotes(next);
      if (doctorId) {
        const { upsertClinicalNote } = await import("@/shared/lib/api/clinical");
        await upsertClinicalNote(appointmentId, doctorId, next);
        setLastSavedAt(new Date());
      }
      requestNotesEditorFocus();
      toast.success(
        mode === "replace"
          ? "SOAP aplicado — reemplazó las notas"
          : "SOAP aplicado al final de las notas",
      );
    } catch {
      toast.error("Error al guardar las notas");
    } finally {
      setIsApplying(false);
    }
  };

  const soapSections = summary
    ? [
        { key: "S", label: "Subjetivo", content: summary.subjective },
        { key: "O", label: "Objetivo", content: summary.objective },
        { key: "A", label: "Análisis", content: summary.analysis },
        { key: "P", label: "Plan", content: summary.plan },
      ]
    : [];

  const hasNotes = !!clinicalNotes.trim();

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Brain className="h-4 w-4 text-violet-600" />
          Resumen Post-Consulta (IA)
          <span className="ml-auto inline-flex items-center gap-1 rounded border border-violet-200 px-1.5 py-0.5 text-xs text-violet-600">
            <Sparkles className="h-3 w-3" />
            Gemini
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!summary ? (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              Generá un resumen SOAP desde la transcripción y las notas. Luego
              podés aplicarlo al editor de notas para revisarlo y editarlo.
            </p>
            <Button
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
              className="w-full bg-violet-700 hover:bg-violet-800"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-1" />
                  Generar resumen SOAP
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            {soapSections.map((section) => (
              <div
                key={section.key}
                className="rounded-lg border border-slate-100 p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-100 text-violet-700 text-xs font-bold">
                    {section.key}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {section.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </p>
              </div>
            ))}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={() =>
                  void handleApplyToNotes(hasNotes ? "append" : "replace")
                }
                disabled={isApplying}
                className="w-full bg-brand hover:bg-brand-600"
                size="sm"
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileEdit className="h-4 w-4 mr-1" />
                )}
                {hasNotes
                  ? "Aplicar SOAP al final de las notas"
                  : "Aplicar SOAP a notas"}
              </Button>
              {hasNotes && (
                <Button
                  onClick={() => void handleApplyToNotes("replace")}
                  disabled={isApplying}
                  variant="outline"
                  className="w-full text-xs"
                  size="sm"
                >
                  Reemplazar notas con SOAP
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSummary(null);
                    void handleGenerate();
                  }}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Regenerar
                </Button>
                {onConsultationEnd && (
                  <Button
                    onClick={onConsultationEnd}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    Finalizar consulta
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
