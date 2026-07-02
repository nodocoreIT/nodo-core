"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Loader2,
  Sparkles,
  FileEdit,
  RotateCcw,
} from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { clinicApi } from "@/lib/clinic/client-api";
import { formatSoapAsMarkdown, toSoapSummary } from "@/lib/soap/format";
import { toast } from "sonner";
import type { SoapSummary } from "@/types";

interface SoapSummaryPanelProps {
  appointmentId: string;
  doctorId?: string;
  dataSource?: "local" | "supabase";
  onConsultationEnd?: () => void;
}

export function SoapSummaryPanel({
  appointmentId,
  doctorId,
  dataSource = "supabase",
  onConsultationEnd,
}: SoapSummaryPanelProps) {
  const {
    transcriptionText,
    clinicalNotes,
    setClinicalNotes,
    setLastSavedAt,
    requestNotesEditorFocus,
  } = useConsultationStore();
  const [summary, setSummary] = useState<SoapSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleGenerate = async () => {
    if (!transcriptionText && !clinicalNotes) {
      toast.error("No hay transcripción ni notas para generar el resumen");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/soap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          transcription: transcriptionText,
          clinicalNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error en generación");
      }

      const data = await res.json();
      setSummary(toSoapSummary(appointmentId, data));
      toast.success("Resumen SOAP generado con IA");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al generar resumen SOAP"
      );
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

      if (dataSource === "local" && doctorId) {
        await clinicApi.saveNotes(appointmentId, doctorId, next);
        setLastSavedAt(new Date());
      }

      requestNotesEditorFocus();
      toast.success(
        mode === "replace"
          ? "SOAP aplicado — reemplazó las notas"
          : "SOAP aplicado al final de las notas"
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
          <Badge variant="outline" className="ml-auto text-xs border-violet-200 text-violet-600">
            <Sparkles className="h-3 w-3 mr-1" />
            Gemini
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!summary ? (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              Durante la consulta, escribí notas en el panel. Al terminar, este
              botón arma un resumen <strong>SOAP</strong> (Subjetivo, Objetivo,
              Análisis, Plan) y lo podés pegar en las notas clínicas para
              editarlo.
            </p>
            {!transcriptionText && !clinicalNotes && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                Primero escribí notas clínicas o dictá durante la consulta.
              </p>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || (!transcriptionText && !clinicalNotes)}
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
              <div key={section.key} className="rounded-lg border border-slate-100 p-3">
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
                onClick={() => handleApplyToNotes(hasNotes ? "append" : "replace")}
                disabled={isApplying}
                className="w-full bg-blue-700 hover:bg-blue-800"
                size="sm"
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileEdit className="h-4 w-4 mr-1" />
                )}
                {hasNotes ? "Aplicar SOAP al final de las notas" : "Aplicar SOAP a notas"}
              </Button>
              {hasNotes && (
                <Button
                  onClick={() => handleApplyToNotes("replace")}
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
