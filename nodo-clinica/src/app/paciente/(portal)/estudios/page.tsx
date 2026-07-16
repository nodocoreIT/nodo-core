"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, FlaskConical } from "lucide-react";

interface SelectedFile {
  name: string;
  size: number;
  type: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EstudiosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next: SelectedFile[] = Array.from(incoming).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...next.filter((f) => !names.has(f.name))];
    });
  }

  function remove(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Coming soon banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 flex items-start gap-3">
        <FlaskConical className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Estamos trabajando en este módulo
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Pronto vas a poder organizar, compartir y acceder a todos tus estudios digitales desde acá.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors",
          dragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40",
        ].join(" ")}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Upload className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            Arrastrá tus archivos acá o{" "}
            <span className="text-emerald-600 underline underline-offset-2">
              seleccioná desde tu dispositivo
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            PDF, imágenes, DICOM — hasta 20 MB por archivo
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.dcm,image/*,application/pdf"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{f.name}</p>
                <p className="text-xs text-slate-400">{formatSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(f.name)}
                className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
