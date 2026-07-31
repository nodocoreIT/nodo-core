"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReportSection {
  title: string;
  body: string;
}

/** Divide el markdown del informe en secciones por encabezado "## " —
 * agnóstico de qué títulos use la IA, no depende de una lista fija. */
export function parseReportSections(markdown: string): ReportSection[] {
  const lines = markdown.split("\n");
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.*)$/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = { title: headerMatch[1].trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (line.trim()) {
      // Contenido antes del primer "##" — se conserva sin encabezado en vez de perderse.
      current = { title: "", body: line };
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => ({ ...s, body: s.body.trim() }));
}

export function serializeReportSections(sections: ReportSection[]): string {
  return sections
    .map((s) => (s.title ? `## ${s.title}\n${s.body}` : s.body))
    .join("\n\n")
    .trim();
}

interface ReportEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: string;
  onChange: (markdown: string) => void;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  signatureText?: string;
  signatureImageData?: string;
  onSave: () => void;
  onDownload: () => void;
  isSaving?: boolean;
}

export function ReportEditorDialog({
  open,
  onOpenChange,
  report,
  onChange,
  patientName,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  signatureText,
  signatureImageData,
  onSave,
  onDownload,
  isSaving,
}: ReportEditorDialogProps) {
  // Se re-parsea desde `report` solo al abrir — mientras el modal está
  // abierto, la edición local manda (evita pisar lo que el médico tipea
  // si el padre re-renderiza por otro motivo).
  const [sections, setSections] = useState<ReportSection[]>(() =>
    parseReportSections(report),
  );

  useEffect(() => {
    if (open) setSections(parseReportSections(report));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateSectionBody(index: number, body: string) {
    setSections((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, body } : s));
      onChange(serializeReportSections(next));
      return next;
    });
  }

  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl w-[95vw] h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-lg font-semibold text-[#1e406e] text-center">
            Informe Médico
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            Revisá y editá cada sección — se guarda tal como quede acá.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="text-center text-xs text-slate-500 space-y-0.5 pb-3 border-b border-slate-100">
            <p className="font-medium text-slate-700">
              Dr/a. {doctorName}
              {doctorSpecialty ? ` — ${doctorSpecialty}` : ""}
            </p>
            {doctorLicense && <p>Mat. Prof. {doctorLicense}</p>}
          </div>

          <div className="text-sm text-slate-700 space-y-0.5">
            <p>
              <span className="font-medium">Paciente:</span> {patientName}
            </p>
            <p>
              <span className="font-medium">Fecha:</span> {today}
            </p>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              Sin contenido todavía.
            </p>
          ) : (
            sections.map((section, index) => (
              <div key={index} className="space-y-4">
                {section.title && (
                  <h3 className="text-sm font-semibold text-[#1e406e]">
                    {section.title}
                  </h3>
                )}
                <Textarea
                  value={section.body}
                  onChange={(e) => updateSectionBody(index, e.target.value)}
                  className="text-sm leading-relaxed min-h-[70px] resize-y focus-visible:ring-1 focus-visible:ring-blue-300"
                />
              </div>
            ))
          )}

          <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col items-end gap-1">
            {signatureImageData?.startsWith("data:image") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureImageData}
                alt="Firma"
                className="h-12 object-contain"
              />
            )}
            <p className="text-sm font-medium text-[#1e406e]">
              {signatureText || `Dr/a. ${doctorName}`}
            </p>
            {doctorLicense && (
              <p className="text-xs text-[#1e406e]">Mat. {doctorLicense}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button
            onClick={onSave}
            disabled={isSaving || !report.trim()}
            className="bg-blue-700 hover:bg-blue-800 flex-1 min-w-[160px]"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Confirmar y guardar
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onDownload} disabled={!report.trim()}>
            <Download className="h-4 w-4 mr-1" />
            PDF firmado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
