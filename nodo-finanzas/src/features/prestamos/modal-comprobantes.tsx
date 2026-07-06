import { useEffect, useRef, useState } from 'react';
import { X, Upload, Trash2, ZoomIn, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinanzasService } from '@/services/finanzas-service';
import toast from 'react-hot-toast';
import type { Prestamo, PrestamoComprobante } from '@/types';

interface ModalComprobantesProps {
  prestamo: Prestamo;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(comprobante: PrestamoComprobante): boolean {
  return (comprobante.tipo ?? '').startsWith('image/');
}

export function ModalComprobantes({ prestamo, onClose }: ModalComprobantesProps) {
  const [comprobantes, setComprobantes] = useState<PrestamoComprobante[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PrestamoComprobante | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    FinanzasService.obtenerComprobantes(prestamo.id).then((data) => {
      if (active) {
        setComprobantes(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [prestamo.id]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const toUpload = Array.from(files);
    const results = await Promise.all(
      toUpload.map((f) => FinanzasService.subirComprobantePrestamo(prestamo.id, f)),
    );
    const succeeded = results.filter((r): r is PrestamoComprobante => r !== null);
    if (succeeded.length > 0) {
      setComprobantes((prev) => [...prev, ...succeeded]);
      toast.success(
        succeeded.length === 1
          ? 'Comprobante subido'
          : `${succeeded.length} comprobantes subidos`,
      );
    }
    if (succeeded.length < toUpload.length) {
      toast.error('Algunos archivos no pudieron subirse');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (c: PrestamoComprobante) => {
    if (!window.confirm(`¿Eliminar "${c.nombre}"?`)) return;
    setDeleting(c.id);
    const ok = await FinanzasService.eliminarComprobante(c);
    if (ok) {
      setComprobantes((prev) => prev.filter((x) => x.id !== c.id));
      if (preview?.id === c.id) setPreview(null);
      toast.success('Comprobante eliminado');
    } else {
      toast.error('Error al eliminar el comprobante');
    }
    setDeleting(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-mist shrink-0">
            <div>
              <h3 className="text-base font-bold text-ink">Comprobantes</h3>
              <p className="text-xs text-slate2 mt-0.5">{prestamo.concepto}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-mist transition-colors"
            >
              <X className="w-5 h-5 text-slate2" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-mist rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-brand animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-slate2" />
              )}
              <p className="text-sm text-slate2">
                {uploading
                  ? 'Subiendo archivos...'
                  : 'Arrastrá o hacé clic para adjuntar fotos'}
              </p>
              <p className="text-xs text-slate2/70">JPG, PNG, WEBP, HEIC, PDF · máx. 10 MB c/u</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-slate2 animate-spin" />
              </div>
            ) : comprobantes.length === 0 ? (
              <p className="text-center text-sm text-slate2 py-4">
                No hay comprobantes adjuntos
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {comprobantes.map((c) => (
                  <div
                    key={c.id}
                    className="relative group rounded-lg border border-mist overflow-hidden bg-paper"
                  >
                    {isImage(c) ? (
                      <img
                        src={c.url}
                        alt={c.nombre}
                        className="w-full h-28 object-cover"
                      />
                    ) : (
                      <div className="w-full h-28 flex flex-col items-center justify-center gap-1 bg-mist/30">
                        <FileText className="w-8 h-8 text-slate2" />
                        <span className="text-[10px] text-slate2 uppercase font-medium">PDF</span>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {isImage(c) && (
                        <button
                          onClick={() => setPreview(c)}
                          className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          title="Ver"
                        >
                          <ZoomIn className="w-4 h-4 text-ink" />
                        </button>
                      )}
                      {!isImage(c) && c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                          title="Abrir PDF"
                        >
                          <FileText className="w-4 h-4 text-ink" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting === c.id}
                        className="p-1.5 bg-white/90 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        {deleting === c.id ? (
                          <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="p-2">
                      <p className="text-[11px] text-ink font-medium truncate">{c.nombre}</p>
                      {c.tamanio && (
                        <p className="text-[10px] text-slate2">{formatBytes(c.tamanio)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-mist shrink-0">
            <Button variant="outline" onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {/* Preview lightbox */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setPreview(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            onClick={() => setPreview(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={preview.url}
            alt={preview.nombre}
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
