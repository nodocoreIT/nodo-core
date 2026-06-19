import { useRef, useState } from "react";
import { Download, Eye, FileText, Trash2, Upload } from "lucide-react";
import { Input } from "@nodocore/shared-components";
import { toast } from "sonner";
import { DocumentPreviewer } from "@/components/document-previewer";
import type { VehicleDocument } from "@/types";
import { fileToBase64 } from "@/utils/vehicle-helpers";

interface VehicleDocumentsPanelProps {
  documents: VehicleDocument[];
  onChange: (documents: VehicleDocument[]) => void;
  readOnly?: boolean;
}

export function VehicleDocumentsPanel({
  documents,
  onChange,
  readOnly = false,
}: VehicleDocumentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      const newDocs: VehicleDocument[] = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} supera los 10MB`);
          continue;
        }
        const base64 = await fileToBase64(file);
        newDocs.push({
          name: file.name,
          url: base64,
          type: file.type,
          label: "",
          creadoEn: new Date().toISOString(),
        });
      }
      onChange([...documents, ...newDocs]);
    } catch {
      toast.error("Error al cargar documentos");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateLabel(index: number, label: string) {
    onChange(documents.map((doc, i) => (i === index ? { ...doc, label } : doc)));
  }

  function removeDoc(index: number) {
    onChange(documents.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            multiple
            className="hidden"
            onChange={handleSelect}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-mist px-5 py-4 text-sm text-slate2 hover:border-brand hover:text-brand transition-colors w-full justify-center disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Subiendo…" : "Agregar documentos (PDF, JPG, PNG — máx. 10MB)"}
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate2">
          <FileText className="h-10 w-10 text-slate2-300" />
          <p className="text-sm">No hay documentación cargada.</p>
          {!readOnly && <p className="text-xs text-slate2-300">Título, cédula, verificación policial, etc.</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc, index) => (
            <div
              key={`${doc.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-mist bg-white p-3 shadow-sm"
            >
              <FileText className="h-5 w-5 text-brand shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                {readOnly ? (
                  <p className="text-sm font-medium text-navy truncate">{doc.label || doc.name}</p>
                ) : (
                  <Input
                    value={doc.label ?? ""}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    placeholder="Etiqueta (ej. Título, Cédula)"
                    className="h-8 text-sm"
                  />
                )}
                <p className="text-xs text-slate2 truncate">{doc.name}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(doc)}
                  className="p-1.5 text-slate2 hover:text-brand rounded"
                  title="Vista previa"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <a
                  href={doc.url}
                  download={doc.name}
                  className="p-1.5 text-slate2 hover:text-navy rounded"
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeDoc(index)}
                    className="p-1.5 text-slate2 hover:text-red-600 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewer document={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}
