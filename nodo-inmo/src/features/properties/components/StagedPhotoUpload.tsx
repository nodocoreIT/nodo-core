import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useStagedPropertyPhotos } from "../hooks/use-stage-property-photo";
import { usePropertyPhotos } from "../hooks/use-property-photos";
import { cn } from "@/shared/lib/utils";

interface StagedPhotoUploadProps {
  paths: string[];
  onChange: (paths: string[]) => void;
}

export function StagedPhotoUpload({ paths, onChange }: StagedPhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, removePhoto, isPending } = useStagedPropertyPhotos();
  const { data: photos = [] } = usePropertyPhotos(paths);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    let current = [...paths];
    for (const file of files) {
      current = await uploadPhoto(file, current);
      onChange([...current]);
    }
  }

  async function handleRemove(path: string) {
    const next = await removePhoto(path, paths);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Fotos{" "}
        {photos.length > 0 && (
          <span className="font-normal text-slate2">({photos.length} cargadas)</span>
        )}
      </p>
      {photos.length > 0 && (
        <p className="text-xs text-slate2">La primera foto es la portada.</p>
      )}
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Agregar foto"
        >
          {isPending ? (
            <Loader2 className="h-8 w-8 animate-spin text-slate2" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/80">
              <ImagePlus className="h-6 w-6 text-slate-500" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">
              {isPending ? "Subiendo..." : "No hay fotos cargadas"}
            </p>
            {!isPending && (
              <p className="mt-0.5 text-xs text-slate2">
                Hacé click para seleccionar imágenes
              </p>
            )}
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map(({ path, url }, i) => (
            <div key={path} className="group relative">
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className={cn(
                  "h-32 w-full rounded-lg border-2 object-cover shadow-sm",
                  i === 0 ? "border-brand ring-2 ring-brand/20" : "border-border",
                )}
              />
              <button
                type="button"
                onClick={() => void handleRemove(path)}
                disabled={isPending}
                className="absolute -right-2 -top-2 z-10 rounded-full bg-destructive p-1.5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 hover:bg-destructive/80 disabled:opacity-40"
                aria-label="Eliminar foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded border border-brand/20 bg-brand/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  Portada
                </span>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-mist transition-colors hover:bg-mist/70 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Agregar foto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-slate2" />
                <span className="text-[11px] text-slate2">Subiendo…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-slate2" />
                <span className="text-[11px] text-slate2">Agregar foto</span>
              </>
            )}
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
