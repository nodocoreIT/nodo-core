"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { obraApi } from "@/lib/obra/client-api";
import type { LocalFotoAvance } from "@/lib/obra/types";

interface ObraFotosPanelProps {
  proyectoId: string;
  fotos: LocalFotoAvance[];
  onChange: () => void;
  readOnly?: boolean;
}

export function ObraFotosPanel({
  proyectoId,
  fotos,
  onChange,
  readOnly = false,
}: ObraFotosPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    descripcion: "",
    fecha: new Date().toISOString().slice(0, 10),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await obraApi.uploadFotoAvance(proyectoId, {
        imagen: file,
        descripcion: form.descripcion,
        fecha: form.fecha,
      });
      setForm({ descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
      onChange();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta foto de avance?")) return;
    await obraApi.deleteFotoAvance(id);
    onChange();
  };

  return (
    <section className="rounded-xl border border-mist bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display font-bold text-navy">
            <Camera className="h-4 w-4 text-brand" />
            Avance visual de obra
          </h3>
          <p className="text-sm text-slate2">
            Fotos de progreso visibles en la ficha y el portal cliente.
          </p>
        </div>
      </div>

      {!readOnly && (
        <div className="mb-6 grid gap-3 rounded-lg border border-dashed border-mist p-4 sm:grid-cols-[1fr_140px_auto]">
          <div className="space-y-2">
            <Label htmlFor="foto-desc">Descripción</Label>
            <Input
              id="foto-desc"
              value={form.descripcion}
              onChange={(e) =>
                setForm((f) => ({ ...f, descripcion: e.target.value }))
              }
              placeholder="Ej: Terminación revoque living"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="foto-fecha">Fecha avance</Label>
            <Input
              id="foto-fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && form.descripcion.trim()) {
                  handleUpload(file);
                }
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              disabled={uploading || !form.descripcion.trim()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? "Subiendo…" : "Cargar foto"}
            </Button>
          </div>
        </div>
      )}

      {fotos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate2">
          No hay fotos cargadas todavía.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto) => (
            <figure
              key={foto.id}
              className="group overflow-hidden rounded-lg border border-mist bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={obraApi.fotoAvanceUrl(foto.id)}
                alt={foto.descripcion}
                className="h-28 w-full object-cover"
              />
              <figcaption className="p-2 text-xs">
                <p className="font-semibold text-brand">{foto.fechaAvance}</p>
                <p className="line-clamp-2 text-navy">{foto.descripcion}</p>
                {!readOnly && (
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1 text-red-600 hover:underline"
                    onClick={() => handleDelete(foto.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
