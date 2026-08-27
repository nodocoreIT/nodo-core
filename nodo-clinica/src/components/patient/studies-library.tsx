"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, FolderOpen, Loader2, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ALLOWED_LABEL = "PDF, JPG o PNG";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PersonalStudy {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  downloadUrl: string;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return `"${file.name}" no es un formato admitido. Solo se aceptan ${ALLOWED_LABEL}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" supera el tamaño máximo de 10 MB.`;
  }
  return null;
}

/** Personal study library for PRO-plan patients: upload, list, download, delete. */
export function StudiesLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [studies, setStudies] = useState<PersonalStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersonalStudy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudies = useCallback(() => {
    setLoading(true);
    clinicApi
      .getPatientStudies()
      .then((data) => setStudies(Array.isArray(data) ? data : []))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "No se pudieron cargar tus estudios");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  const uploadFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const files = Array.from(incoming);
      setUploading(true);
      try {
        for (const file of files) {
          const validationError = validateFile(file);
          if (validationError) {
            toast.error(validationError);
            continue;
          }
          try {
            await clinicApi.uploadStudy(file);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : `No se pudo subir "${file.name}"`);
          }
        }
        loadStudies();
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [loadStudies],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await clinicApi.deleteDocument(deleteTarget.id);
      setStudies((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Estudio eliminado");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el estudio");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors",
          uploading ? "cursor-wait opacity-70" : "cursor-pointer",
          dragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40",
        ].join(" ")}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
          ) : (
            <Upload className="h-5 w-5 text-emerald-600" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {uploading ? (
              "Subiendo archivo..."
            ) : (
              <>
                Arrastrá tus archivos acá o{" "}
                <span className="text-emerald-600 underline underline-offset-2">
                  seleccioná desde tu dispositivo
                </span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">{ALLOWED_LABEL} — hasta 10 MB por archivo</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
      </div>

      {/* Study list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : studies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No hay estudios cargados todavía</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {studies.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{doc.fileName}</p>
                <p className="text-xs text-slate-400">
                  {format(new Date(doc.uploadedAt), "dd MMM yyyy · HH:mm", { locale: es })}
                </p>
              </div>
              <a
                href={doc.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                aria-label="Descargar"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
              </a>
              <button
                type="button"
                onClick={() => setDeleteTarget(doc)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white hover:border-red-200 hover:bg-red-50"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar estudio"
        description={
          deleteTarget
            ? `Se eliminará "${deleteTarget.fileName}" de forma permanente.`
            : undefined
        }
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
