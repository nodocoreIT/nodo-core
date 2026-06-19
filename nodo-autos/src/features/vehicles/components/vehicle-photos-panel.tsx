import { useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface VehiclePhotosPanelProps {
  photos: string[];
  uploadingPhotos: boolean;
  uploadProgress?: { current: number; total: number } | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotosChange: (photos: string[]) => void;
}

function reorderPhotos(photos: string[], from: number, to: number): string[] {
  const next = [...photos];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function PhotoUploadLoader({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 text-center max-w-xs">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-brand/20" />
          <div
            className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin"
          />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-brand/10">
            <Upload className="h-5 w-5 text-brand animate-pulse" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-navy">Subiendo fotos…</p>
          <p className="text-xs text-slate2">
            {current} de {total} · no cierres esta ventana
          </p>
        </div>

        <div className="w-full space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[10px] font-medium text-slate2 tabular-nums">{percent}%</p>
        </div>
      </div>
    </div>
  );
}

export function VehiclePhotosPanel({
  photos,
  uploadingPhotos,
  uploadProgress,
  fileInputRef,
  onFileSelect,
  onPhotosChange,
}: VehiclePhotosPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const from =
      draggedIndex ?? Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(from) || from === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    onPhotosChange(reorderPhotos(photos, from, index));
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const progress = uploadProgress ?? { current: 0, total: 1 };

  return (
    <div className="relative space-y-4">
      {uploadingPhotos && (
        <PhotoUploadLoader current={progress.current} total={progress.total} />
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhotos}
          className={cn(
            "flex items-center gap-2 rounded-lg border-2 border-dashed px-5 py-4 text-sm w-full justify-center transition-all",
            uploadingPhotos
              ? "border-brand/40 bg-brand/5 text-brand cursor-wait"
              : "border-mist text-slate2 hover:border-brand hover:text-brand hover:bg-brand/5",
          )}
        >
          <Upload size={18} className={uploadingPhotos ? "animate-bounce" : undefined} />
          {uploadingPhotos
            ? `Procesando foto ${progress.current} de ${progress.total}…`
            : "Seleccioná fotos (máx. 5MB c/u)"}
        </button>
      </div>

      {photos.length > 0 && (
        <>
          <p className="text-xs text-slate2">
            Arrastrá las fotos para reordenar · la primera es la portada
          </p>
          <div
            className={cn(
              "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 transition-opacity",
              uploadingPhotos && "opacity-40 pointer-events-none",
            )}
          >
            {photos.map((url, index) => {
              const isDragging = draggedIndex === index;
              const isDropTarget = dragOverIndex === index && draggedIndex !== index;

              return (
                <div
                  key={`${url}-${index}`}
                  draggable={!uploadingPhotos}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "relative group aspect-square rounded-lg cursor-grab active:cursor-grabbing transition-all",
                    isDragging && "opacity-40 scale-95",
                    isDropTarget && "ring-2 ring-brand ring-offset-2",
                  )}
                  title={index === 0 ? "Portada" : "Arrastrá para cambiar posición"}
                >
                  <img
                    src={url}
                    alt={`Foto ${index + 1}`}
                    draggable={false}
                    className="w-full h-full object-cover rounded-lg border border-mist pointer-events-none select-none"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white pointer-events-none">
                      Portada
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={uploadingPhotos}
                      className="rounded bg-white/90 p-1.5 text-red-600 hover:bg-white disabled:opacity-50"
                      title="Eliminar foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {photos.length === 0 && !uploadingPhotos && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate2/60">
          <ImageIcon size={32} />
          <p className="text-xs">Sin fotos aún. La primera que subas será la portada.</p>
        </div>
      )}
    </div>
  );
}
