"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Plus, Trash2, Save, Upload, Loader2, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Slide {
  imagen_url: string;
  titulo?: string;
  subtitulo?: string;
  href?: string;
}

const CLAVE = "hero_slides";
const BUCKET = "slides";

export default function SliderConfig() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", CLAVE)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.valor) {
          try {
            const parsed = JSON.parse(data.valor);
            if (Array.isArray(parsed)) setSlides(parsed);
          } catch {
            setSlides([]);
          }
        }
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateSlide(index: number, field: keyof Slide, value: string) {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function removeSlide(index: number) {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current!, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOver(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOver(null);
  }

  function addSlide() {
    setSlides((prev) => [
      ...prev,
      { imagen_url: "", titulo: "", subtitulo: "", href: "" },
    ]);
  }

  async function handleFileChange(index: number, file: File) {
    if (!file) return;

    const ext = file.name.split(".").pop();
    const fileName = `slide-${Date.now()}.${ext}`;

    setUploading(index);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error("Error al subir la imagen: " + uploadError.message);
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    updateSlide(index, "imagen_url", data.publicUrl);
    setUploading(null);
  }

  async function save() {
    const validSlides = slides.filter((s) => s.imagen_url.trim() !== "");
    if (validSlides.length === 0) {
      toast.error("Agregá al menos un slide con imagen.");
      return;
    }

    setSaving(true);
    const valor = JSON.stringify(validSlides);

    const { error } = await supabase.from("configuracion").upsert(
      { clave: CLAVE, valor, descripcion: "Slides del hero de la homepage" },
      { onConflict: "clave" }
    );

    setSaving(false);

    if (error) {
      toast.error("Error al guardar: " + error.message);
    } else {
      setSlides(validSlides);
      toast.success("Slider guardado correctamente.");
    }
  }

  return (
    <section className="bg-luxury-black border border-luxury-gray p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">
            Homepage
          </p>
          <h2 className="text-white text-xl font-serif">
            Configuración del Slider
          </h2>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold text-black text-sm font-bold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Guardar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-4">
          {slides.length === 0 && (
            <p className="text-[#555555] text-sm text-center py-8">
              No hay slides configurados. Agregá uno para comenzar.
            </p>
          )}

          {slides.map((slide, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`flex gap-4 items-start border bg-[#0A0A0A] p-4 transition-all ${
                dragOver === i ? "border-gold opacity-70" : "border-luxury-gray"
              }`}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 flex items-center self-stretch cursor-grab active:cursor-grabbing text-[#333] hover:text-[#555] transition-colors pr-1">
                <GripVertical size={16} />
              </div>
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-20 h-14 bg-luxury-gray border border-luxury-gray-mid overflow-hidden relative rounded-sm">
                {slide.imagen_url ? (
                  <Image
                    src={slide.imagen_url}
                    alt={`Slide ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#333]">
                    <Upload size={16} />
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-[#555555] text-xs tracking-widest uppercase mb-1">
                    Imagen *
                  </label>
                  <input
                    ref={(el) => { fileInputRefs.current[i] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(i, file);
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[i]?.click()}
                      disabled={uploading === i}
                      className="flex items-center gap-2 px-4 py-2 border border-luxury-gray-mid text-luxury-gray-light hover:border-gold hover:text-gold text-xs transition-colors disabled:opacity-50"
                    >
                      {uploading === i ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {uploading === i ? "Subiendo..." : "Elegir imagen"}
                    </button>
                    {slide.imagen_url && (
                      <span className="text-[#555555] text-xs truncate max-w-[200px]">
                        {slide.imagen_url.split("/").pop()}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[#555555] text-xs tracking-widest uppercase mb-1">
                    Título (opcional)
                  </label>
                  <input
                    type="text"
                    value={slide.titulo ?? ""}
                    onChange={(e) => updateSlide(i, "titulo", e.target.value)}
                    placeholder="Ej: Nueva colección árabe"
                    className="w-full bg-[#111] border border-luxury-gray-mid text-white text-sm px-3 py-2 focus:outline-none focus:border-gold transition-colors placeholder-[#333]"
                  />
                </div>
                <div>
                  <label className="block text-[#555555] text-xs tracking-widest uppercase mb-1">
                    Subtítulo (opcional)
                  </label>
                  <input
                    type="text"
                    value={slide.subtitulo ?? ""}
                    onChange={(e) => updateSlide(i, "subtitulo", e.target.value)}
                    placeholder="Ej: Fragancias exclusivas"
                    className="w-full bg-[#111] border border-luxury-gray-mid text-white text-sm px-3 py-2 focus:outline-none focus:border-gold transition-colors placeholder-[#333]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#555555] text-xs tracking-widest uppercase mb-1">
                    Link (opcional)
                  </label>
                  <input
                    type="text"
                    value={slide.href ?? ""}
                    onChange={(e) => updateSlide(i, "href", e.target.value)}
                    placeholder="Ej: /productos?categoria=arabes"
                    className="w-full bg-[#111] border border-luxury-gray-mid text-white text-sm px-3 py-2 focus:outline-none focus:border-gold transition-colors placeholder-[#333]"
                  />
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => removeSlide(i)}
                aria-label="Eliminar slide"
                className="flex-shrink-0 p-2 text-[#555555] hover:text-red-500 transition-colors mt-0.5"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button
            onClick={addSlide}
            className="flex items-center gap-2 text-gold hover:text-white text-sm border border-luxury-gray-mid hover:border-gold px-4 py-2.5 transition-colors w-full justify-center"
          >
            <Plus size={14} />
            Agregar slide
          </button>
        </div>
      )}
    </section>
  );
}
