import { X, Download, ExternalLink, FileText, AlertCircle } from "lucide-react";
import type { VehicleDocument } from "@/types";

interface DocumentPreviewerProps {
  document: VehicleDocument;
  onClose: () => void;
}

export function DocumentPreviewer({ document, onClose }: DocumentPreviewerProps) {
  const isImage = document.type.startsWith("image/");
  const isPDF = document.type === "application/pdf";
  const isDoc =
    document.name.toLowerCase().endsWith(".doc") ||
    document.name.toLowerCase().endsWith(".docx");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mist bg-paper">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="p-2 bg-brand/10 text-brand rounded-lg shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h3 className="text-sm font-semibold text-navy truncate">
                {document.label || document.name}
              </h3>
              <p className="text-xs text-slate2 uppercase">
                {document.label ? document.name : document.type.split("/")[1] || "Documento"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate2 hover:text-brand rounded-lg"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <a href={document.url} download={document.name} className="p-2 text-slate2 hover:text-emerald-600 rounded-lg" title="Descargar">
              <Download className="h-5 w-5" />
            </a>
            <button type="button" onClick={onClose} className="p-2 text-slate2 hover:text-red-500 rounded-lg" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-paper overflow-auto flex items-center justify-center p-4">
          {isImage ? (
            <img src={document.url} alt={document.name} className="max-h-full max-w-full object-contain shadow-lg rounded" />
          ) : isPDF ? (
            <iframe src={`${document.url}#toolbar=0`} title={document.name} className="w-full h-full min-h-[60vh] rounded border border-mist" />
          ) : isDoc ? (
            <div className="flex flex-col items-center gap-3 text-center p-8">
              <AlertCircle className="h-12 w-12 text-slate2-300" />
              <p className="text-sm text-slate2">Vista previa no disponible para Word. Descargá el archivo.</p>
              <a href={document.url} download={document.name} className="text-sm font-medium text-brand hover:underline">
                Descargar {document.name}
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center p-8">
              <FileText className="h-12 w-12 text-slate2-300" />
              <a href={document.url} download={document.name} className="text-sm font-medium text-brand hover:underline">
                Descargar {document.name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
