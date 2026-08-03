"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, FlaskConical, Pill } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionClinicalDocument } from "@/lib/clinic/session-clinical-documents";
import { ClinicalDocumentPreviewDialog } from "@/components/patient/clinical-document-preview-dialog";

interface ConsultationSessionDocumentsCardProps {
  documents: SessionClinicalDocument[];
  className?: string;
  /** Dark background (videollamada) vs sala de espera clara */
  variant?: "light" | "dark";
}

function recordTypeLabel(type: SessionClinicalDocument["recordType"]) {
  return type === "receta" ? "Receta" : "Estudios";
}

export function ConsultationSessionDocumentsCard({
  documents,
  className,
  variant = "light",
}: ConsultationSessionDocumentsCardProps) {
  const [preview, setPreview] = useState<SessionClinicalDocument | null>(null);
  const sorted = useMemo(
    () =>
      [...documents].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [documents],
  );

  if (sorted.length === 0) return null;

  const isDark = variant === "dark";

  return (
    <>
      <Card
        className={
          className ??
          (isDark
            ? "border-emerald-500/30 bg-slate-900/80 text-white shadow-lg"
            : "border-emerald-100 shadow-sm")
        }
      >
        <CardHeader className="pb-2">
          <CardTitle
            className={`text-sm font-medium flex items-center gap-2 ${
              isDark ? "text-white" : "text-slate-700"
            }`}
          >
            <FileText className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
            Documentos de esta consulta
          </CardTitle>
          <p className={`text-xs ${isDark ? "text-white/70" : "text-slate-500"}`}>
            Recetas y órdenes de estudios emitidas en esta sesión
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((doc) => {
            const Icon = doc.recordType === "receta" ? Pill : FlaskConical;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setPreview(doc)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isDark
                    ? "border-white/10 bg-white/5 hover:bg-white/10"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    doc.recordType === "receta"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-cyan-100 text-cyan-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`block text-sm font-medium truncate ${
                        isDark ? "text-white" : "text-slate-800"
                      }`}
                    >
                      {doc.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        doc.recordType === "receta"
                          ? "border-indigo-200 text-indigo-700"
                          : "border-cyan-200 text-cyan-700"
                      }`}
                    >
                      {recordTypeLabel(doc.recordType)}
                    </Badge>
                  </span>
                  <span className={`block text-[11px] mt-0.5 ${isDark ? "text-white/60" : "text-slate-500"}`}>
                    {format(new Date(doc.createdAt), "dd MMM yyyy · HH:mm", {
                      locale: es,
                    })}
                  </span>
                </span>
                <Eye className={`h-4 w-4 shrink-0 ${isDark ? "text-emerald-300" : "text-emerald-700"}`} />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <ClinicalDocumentPreviewDialog
        open={!!preview}
        title={preview?.title}
        pdfUrl={preview?.pdfUrl}
        onOpenChange={(open) => !open && setPreview(null)}
      />
    </>
  );
}
