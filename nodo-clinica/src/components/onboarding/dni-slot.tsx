"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";

interface DniSlotProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  labelClass: string;
}

export function DniSlot({ label, file, onChange, labelClass }: DniSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <div className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-teal-500 overflow-hidden relative bg-slate-50"
        style={{ aspectRatio: "3/2" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="absolute inset-0 h-full w-full object-contain rounded-xl bg-slate-50"
          />
        ) : (
          <>
            <ImagePlus className="h-7 w-7" />
            <span className="text-xs font-medium">Subir foto</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
