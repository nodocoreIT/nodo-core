"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Save, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  descripcion: string | null;
  activo: boolean;
}

interface Props {
  marcas: Marca[];
}

const EMPTY_FORM = {
  nombre: "",
  slug: "",
  logo_url: "",
  descripcion: "",
  activo: true,
};

function toSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const inputClass =
  "w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]";
const labelClass =
  "block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5";

export default function MarcasClient({ marcas: initialMarcas }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [marcas, setMarcas] = useState<Marca[]>(initialMarcas);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview("");
    setShowForm(true);
  }

  function openEdit(marca: Marca) {
    setEditingId(marca.id);
    setForm({
      nombre: marca.nombre,
      slug: marca.slug,
      logo_url: marca.logo_url ?? "",
      descripcion: marca.descripcion ?? "",
      activo: marca.activo,
    });
    setLogoFile(null);
    setLogoPreview(marca.logo_url ?? "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setLogoPreview("");
  }

  function handleNombreChange(nombre: string) {
    setForm((prev) => ({
      ...prev,
      nombre,
      slug: editingId ? prev.slug : toSlug(nombre),
    }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return form.logo_url || null;

    setUploading(true);
    const ext = logoFile.name.split(".").pop();
    const fileName = `${toSlug(form.nombre || "marca")}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("marcas")
      .upload(fileName, logoFile, { upsert: true });

    setUploading(false);

    if (error) {
      toast.error("Error al subir el logo.");
      return null;
    }

    const { data } = supabase.storage.from("marcas").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("El slug es obligatorio.");
      return;
    }

    setSaving(true);

    const logoUrl = await uploadLogo();

    const payload = {
      nombre: form.nombre.trim(),
      slug: form.slug.trim(),
      logo_url: logoUrl,
      descripcion: form.descripcion.trim() || null,
      activo: form.activo,
    };

    if (editingId) {
      const { error } = await supabase
        .from("marcas")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        toast.error("Error al actualizar la marca.");
        setSaving(false);
        return;
      }

      setMarcas((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, ...payload } : m
        )
      );
      toast.success("Marca actualizada.");
    } else {
      const { data, error } = await supabase
        .from("marcas")
        .insert(payload)
        .select("id, nombre, slug, logo_url, descripcion, activo")
        .single();

      if (error || !data) {
        toast.error("Error al crear la marca.");
        setSaving(false);
        return;
      }

      setMarcas((prev) => [...prev, data]);
      toast.success("Marca creada.");
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminás esta marca?")) return;

    const { error } = await supabase.from("marcas").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar la marca.");
      return;
    }

    setMarcas((prev) => prev.filter((m) => m.id !== id));
    toast.success("Marca eliminada.");
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
          <h1 className="text-white text-2xl font-serif">Marcas</h1>
          <p className="text-[#555555] text-sm mt-1">
            Gestioná las marcas de tus productos.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2.5 text-xs tracking-wider hover:bg-gold-light transition-colors"
        >
          <Plus size={14} />
          Nueva Marca
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-luxury-black border border-luxury-gray w-full max-w-lg shadow-2xl">
            {/* Form header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-luxury-gray">
              <h2 className="text-gold text-xs tracking-[0.2em] uppercase">
                {editingId ? "Editar Marca" : "Nueva Marca"}
              </h2>
              <button
                onClick={closeForm}
                className="text-[#555] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className={labelClass}>Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Chanel"
                />
              </div>

              {/* Slug */}
              <div>
                <label className={labelClass}>Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="chanel"
                />
              </div>

              {/* Logo */}
              <div>
                <label className={labelClass}>Logo</label>
                {logoPreview && (
                  <div className="mb-3 border border-luxury-gray-mid p-2 bg-[#111] inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer border border-luxury-gray-mid hover:border-gold/50 px-3 py-2 text-xs text-luxury-gray-light hover:text-white transition-colors">
                    <Upload size={13} />
                    {logoFile ? logoFile.name : "Subir imagen"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className={labelClass}>Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Breve descripción de la marca..."
                />
              </div>

              {/* Activo */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, activo: e.target.checked }))
                  }
                  className="w-4 h-4 accent-gold"
                />
                <span className="text-sm text-luxury-gray-light">Marca activa</span>
              </label>
            </div>

            {/* Form actions */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-luxury-gray">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2 text-xs tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
              >
                <Save size={13} />
                {saving || uploading ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={closeForm}
                disabled={saving}
                className="flex items-center gap-2 border border-luxury-gray-mid text-luxury-gray-light hover:text-white px-4 py-2 text-xs transition-colors"
              >
                <X size={13} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <section className="bg-luxury-black border border-luxury-gray">
        <div className="px-5 py-4 border-b border-luxury-gray">
          <p className="text-gold text-xs tracking-[0.2em] uppercase">
            {marcas.length} {marcas.length === 1 ? "marca" : "marcas"}
          </p>
        </div>

        {marcas.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[#555] text-sm">No hay marcas aún. Creá la primera.</p>
          </div>
        ) : (
          <ul className="divide-y divide-luxury-gray">
            {marcas.map((marca) => (
              <li key={marca.id} className="flex items-center gap-4 px-5 py-4">
                {/* Logo */}
                <div className="w-12 h-12 shrink-0 border border-luxury-gray-mid bg-[#111] flex items-center justify-center overflow-hidden">
                  {marca.logo_url ? (
                    <Image
                      src={marca.logo_url}
                      alt={marca.nombre}
                      width={48}
                      height={48}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <span className="text-[#333] text-[10px] uppercase tracking-wider">
                      sin logo
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-semibold truncate">
                      {marca.nombre}
                    </p>
                    {!marca.activo && (
                      <span className="text-[10px] text-[#555] border border-[#333] px-1.5 py-0.5 uppercase tracking-wider">
                        inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-[#555] text-xs font-mono mt-0.5">{marca.slug}</p>
                  {marca.descripcion && (
                    <p className="text-luxury-gray-light text-xs mt-1 truncate">
                      {marca.descripcion}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(marca)}
                    className="p-2 text-[#555] hover:text-gold transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(marca.id)}
                    className="p-2 text-[#555] hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
