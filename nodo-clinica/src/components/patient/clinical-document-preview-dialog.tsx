"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText } from "lucide-react";

interface ClinicalDocumentPreviewDialogProps {
  open: boolean;
  title?: string;
  pdfUrl?: string;
  onOpenChange: (open: boolean) => void;
}

export function ClinicalDocumentPreviewDialog({
  open,
  title,
  pdfUrl,
  onOpenChange,
}: ClinicalDocumentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] sm:max-w-[95vw] flex-col overflow-hidden">
        <DialogTitle className="truncate pr-6 text-base">
          {title ?? "Documento clínico"}
        </DialogTitle>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
          {pdfUrl ? (
            <iframe
              key={pdfUrl}
              src={pdfUrl}
              title={title ?? "Documento PDF"}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No se pudo cargar el documento.</p>
            </div>
          )}
        </div>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-blue-700 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </a>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
