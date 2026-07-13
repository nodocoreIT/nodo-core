"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Pencil, Trash2, Check, X, Layers, Tag, ChevronRight, AlertTriangle, GripVertical, ArrowUpAZ } from "lucide-react";

interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  color: string | null;
  icon: string | null;
  activo: boolean;
}

interface Subcategoria {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  activo: boolean;
  categoria_id: string;
}

interface Props {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
}

const supabase = createClient();

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoriasClient({ categorias: initialCats, subcategorias: initialSubs }: Props) {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>(
    [...initialCats].sort((a, b) => a.nombre.localeCompare(b.nombre))
  );
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>(
    [...initialSubs].sort((a, b) => a.nombre.localeCompare(b.nombre))
  );

  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const dragSubSrcIdx = useRef<number | null>(null);
  const [dragSubOverIdx, setDragSubOverIdx] = useState<number | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(initialCats[0]?.id ?? null);

  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#D4AF37");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");

  const [newSubName, setNewSubName] = useState("");
  const [savingSub, setSavingSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");

  const [error, setError] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  function closeConfirm() {
    setConfirmModal((prev) => ({ ...prev, open: false }));
  }

  const subsForSelected = subcategorias.filter((s) => s.categoria_id === selectedCatId);
  const selectedCat = categorias.find((c) => c.id === selectedCatId);

  // ===================== CATEGORÍAS =====================

  async function handleAddCat() {
    const nombre = newCatName.trim();
    if (!nombre) return;
    setSavingCat(true);
    setError("");
    const slug = slugify(nombre);
    const orden = categorias.length + 1;
    const color = newCatColor || null;
    const icon = newCatIcon.trim() || null;
    const { data, error: err } = await supabase
      .from("categorias")
      .insert({ nombre, slug, orden, color, icon })
      .select()
      .single();
    if (err) { setError(err.message); setSavingCat(false); return; }
    setCategorias((prev) => [...prev, data]);
    setSelectedCatId(data.id);
    setNewCatName("");
    setNewCatColor("#D4AF37");
    setNewCatIcon("");
    setSavingCat(false);
    router.refresh();
  }

  async function handleSaveCat(id: string) {
    const nombre = editCatName.trim();
    if (!nombre) return;
    const slug = slugify(nombre);
    const color = editCatColor || null;
    const icon = editCatIcon.trim() || null;
    const { error: err } = await supabase.from("categorias").update({ nombre, slug, color, icon }).eq("id", id);
    if (err) { setError(err.message); return; }
    setCategorias((prev) => prev.map((c) => c.id === id ? { ...c, nombre, slug, color, icon } : c));
    setEditingCatId(null);
    router.refresh();
  }

  function handleDeleteCat(id: string) {
    setConfirmModal({
      open: true,
      message: "¿Eliminar esta categoría? También se eliminarán sus subcategorías.",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        const { error: err } = await supabase.from("categorias").delete().eq("id", id);
        if (err) { setError(err.message); return; }
        setCategorias((prev) => prev.filter((c) => c.id !== id));
        setSubcategorias((prev) => prev.filter((s) => s.categoria_id !== id));
        if (selectedCatId === id) {
          const remaining = categorias.filter((c) => c.id !== id);
          setSelectedCatId(remaining[0]?.id ?? null);
        }
        router.refresh();
      },
    });
  }

  // ===================== SUBCATEGORÍAS =====================

  async function handleAddSub() {
    const nombre = newSubName.trim();
    if (!nombre || !selectedCatId) return;
    setSavingSub(true);
    setError("");
    const slug = slugify(nombre);
    const orden = subsForSelected.length + 1;
    const { data, error: err } = await supabase
      .from("subcategorias")
      .insert({ nombre, slug, orden, categoria_id: selectedCatId, activo: true })
      .select()
      .single();
    if (err) { setError(err.message); setSavingSub(false); return; }
    setSubcategorias((prev) => [...prev, data]);
    setNewSubName("");
    setSavingSub(false);
    router.refresh();
  }

  async function handleSaveSub(id: string) {
    const nombre = editSubName.trim();
    if (!nombre) return;
    const slug = slugify(nombre);
    const { error: err } = await supabase.from("subcategorias").update({ nombre, slug }).eq("id", id);
    if (err) { setError(err.message); return; }
    setSubcategorias((prev) => prev.map((s) => s.id === id ? { ...s, nombre, slug } : s));
    setEditingSubId(null);
    router.refresh();
  }

  function handleDeleteSub(id: string) {
    setConfirmModal({
      open: true,
      message: "¿Eliminar esta subcategoría?",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        const { error: err } = await supabase.from("subcategorias").delete().eq("id", id);
        if (err) { setError(err.message); return; }
        setSubcategorias((prev) => prev.filter((s) => s.id !== id));
        router.refresh();
      },
    });
  }

  async function handleToggleSubActivo(sub: Subcategoria) {
    const { error: err } = await supabase.from("subcategorias").update({ activo: !sub.activo }).eq("id", sub.id);
    if (err) { setError(err.message); return; }
    setSubcategorias((prev) => prev.map((s) => s.id === sub.id ? { ...s, activo: !s.activo } : s));
  }

  // ===================== DRAG & DROP (categorías) =====================

  function handleDragStart(e: React.DragEvent, i: number) {
    dragSrcIdx.current = i;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIdx(i);
  }

  async function handleToggleCatActivo(cat: Categoria) {
    const { error: err } = await supabase.from("categorias").update({ activo: !cat.activo }).eq("id", cat.id);
    if (err) { setError(err.message); return; }
    setCategorias((prev) => prev.map((c) => c.id === cat.id ? { ...c, activo: !c.activo } : c));
  }

  async function handleSortAlpha() {
    const sorted = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    setCategorias(sorted);
    await Promise.all(
      sorted.map((cat, idx) =>
        supabase.from("categorias").update({ orden: idx + 1 }).eq("id", cat.id)
      )
    );
    router.refresh();
  }

  async function handleDragEnd() {
    const src = dragSrcIdx.current;
    const dst = dragOverIdx;
    dragSrcIdx.current = null;
    setDragOverIdx(null);
    if (src === null || dst === null || src === dst) return;

    const reordered = [...categorias];
    const [moved] = reordered.splice(src, 1);
    reordered.splice(dst, 0, moved);
    setCategorias(reordered);

    await Promise.all(
      reordered.map((cat, idx) =>
        supabase.from("categorias").update({ orden: idx + 1 }).eq("id", cat.id)
      )
    );
    router.refresh();
  }

  // ===================== DRAG & DROP (subcategorías) =====================

  function handleSubDragStart(e: React.DragEvent, i: number) {
    dragSubSrcIdx.current = i;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleSubDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragSubOverIdx(i);
  }

  async function handleSortSubAlpha() {
    if (!selectedCatId) return;
    const currentSubs = subcategorias.filter((s) => s.categoria_id === selectedCatId);
    const sorted = [...currentSubs].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    setSubcategorias((prev) => [
      ...prev.filter((s) => s.categoria_id !== selectedCatId),
      ...sorted,
    ]);
    await Promise.all(
      sorted.map((sub, idx) =>
        supabase.from("subcategorias").update({ orden: idx + 1 }).eq("id", sub.id)
      )
    );
    router.refresh();
  }

  async function handleSubDragEnd() {
    const src = dragSubSrcIdx.current;
    const dst = dragSubOverIdx;
    dragSubSrcIdx.current = null;
    setDragSubOverIdx(null);
    if (src === null || dst === null || src === dst) return;

    const currentSubs = subcategorias.filter((s) => s.categoria_id === selectedCatId);
    const reordered = [...currentSubs];
    const [moved] = reordered.splice(src, 1);
    reordered.splice(dst, 0, moved);

    // Merge reordered subs back into the full subcategorias array
    setSubcategorias((prev) => [
      ...prev.filter((s) => s.categoria_id !== selectedCatId),
      ...reordered,
    ]);

    await Promise.all(
      reordered.map((sub, idx) =>
        supabase.from("subcategorias").update({ orden: idx + 1 }).eq("id", sub.id)
      )
    );
    router.refresh();
  }

  return (
    <>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white">Categorías</h1>
        <p className="text-[#555555] text-xs tracking-widest uppercase mt-1">
          Gestioná las categorías y subcategorías del catálogo
        </p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 px-4 py-3">
          {error}
        </div>
      )}

      {/* ===== FILA 1: Categorías + Subcategorías ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel Categorías */}
        <div className="bg-luxury-black border border-luxury-gray">
          <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
            <Layers size={14} className="text-gold" />
            <h2 className="text-gold text-xs tracking-[0.2em] uppercase flex-1">Categorías</h2>
            <button
              onClick={handleSortAlpha}
              title="Ordenar A-Z y guardar"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#555] hover:text-gold transition-colors px-2 py-1 border border-transparent hover:border-luxury-gray-mid"
            >
              <ArrowUpAZ size={13} />
              A-Z
            </button>
          </div>

          <div className="px-5 py-4 border-b border-luxury-gray space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCat()}
                placeholder="Nueva categoría..."
                className="flex-1 bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#444] px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
              />
              <button
                onClick={handleAddCat}
                disabled={savingCat || !newCatName.trim()}
                className="px-3 py-2 bg-gold text-black hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[#555] text-[10px] uppercase tracking-widest">Color</span>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-8 h-7 cursor-pointer bg-transparent border-0 p-0"
                  title="Color de la categoría"
                />
                <span className="text-[#555] text-[10px] font-mono">{newCatColor}</span>
              </div>
              <input
                type="text"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                placeholder="Icono (ej: flower)"
                className="flex-1 bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#444] px-2 py-1 text-xs focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          <ul className="divide-y divide-luxury-gray">
            {categorias.length === 0 && (
              <li className="px-5 py-6 text-[#333] text-xs italic text-center">No hay categorías todavía.</li>
            )}
            {categorias.map((cat, index) => {
              const subCount = subcategorias.filter((s) => s.categoria_id === cat.id).length;
              const isSelected = cat.id === selectedCatId;
              const isEditing = editingCatId === cat.id;
              return (
                <li
                  key={cat.id}
                  draggable={!isEditing}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => !isEditing && setSelectedCatId(cat.id)}
                  className={`px-5 py-3 flex items-center gap-3 cursor-pointer transition-colors group ${
                    isSelected ? "bg-gold/5 border-l-2 border-gold" : "hover:bg-[#111] border-l-2 border-transparent"
                  } ${dragOverIdx === index ? "border-gold opacity-70" : ""}`}
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveCat(cat.id);
                            if (e.key === "Escape") setEditingCatId(null);
                          }}
                          className="flex-1 bg-luxury-gray border border-gold text-white px-2 py-1 text-sm focus:outline-none"
                        />
                        <button onClick={() => handleSaveCat(cat.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                        <button onClick={() => setEditingCatId(null)} className="text-[#555] hover:text-white p-1"><X size={14} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editCatColor || '#D4AF37'}
                          onChange={(e) => setEditCatColor(e.target.value)}
                          className="w-7 h-6 cursor-pointer bg-transparent border-0 p-0"
                          title="Color"
                        />
                        <input
                          type="text"
                          value={editCatIcon}
                          onChange={(e) => setEditCatIcon(e.target.value)}
                          placeholder="Icono"
                          className="flex-1 bg-luxury-gray border border-luxury-gray-mid text-white px-2 py-1 text-xs focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <GripVertical size={14} className="text-[#333] shrink-0 cursor-grab active:cursor-grabbing" />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: 'var(--color-gold)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? "text-gold" : cat.activo ? "text-white" : "text-[#444] line-through"}`}>
                          {cat.icon && <span className="mr-1 text-[#555] text-xs">{cat.icon}</span>}
                          {cat.nombre}
                        </p>
                        <p className="text-[#444] text-[10px] mt-0.5">{subCount} subcategoría{subCount !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleCatActivo(cat)}
                          className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                            cat.activo ? "border-green-500/30 text-green-500 hover:bg-green-500/10" : "border-[#333] text-[#555] hover:text-white"
                          }`}
                        >
                          {cat.activo ? "ON" : "OFF"}
                        </button>
                        <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.nombre); setEditCatColor(cat.color ?? '#D4AF37'); setEditCatIcon(cat.icon ?? ''); }} className="p-1.5 text-[#555] hover:text-gold transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 text-[#555] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                      {isSelected && <ChevronRight size={14} className="text-gold shrink-0" />}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Panel Subcategorías */}
        <div className="bg-luxury-black border border-luxury-gray">
          <div className="px-5 py-4 border-b border-luxury-gray flex items-center gap-2">
            <Tag size={14} className="text-gold" />
            <h2 className="text-gold text-xs tracking-[0.2em] uppercase flex-1">
              Subcategorías
              {selectedCat && <span className="ml-2 text-[#555] normal-case font-normal">— {selectedCat.nombre}</span>}
            </h2>
            {selectedCatId && (
              <button
                onClick={handleSortSubAlpha}
                title="Ordenar A-Z y guardar"
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#555] hover:text-gold transition-colors px-2 py-1 border border-transparent hover:border-luxury-gray-mid"
              >
                <ArrowUpAZ size={13} />
                A-Z
              </button>
            )}
          </div>

          <div className="px-5 py-4 border-b border-luxury-gray">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSub()}
                placeholder={selectedCat ? `Nueva subcategoría en ${selectedCat.nombre}...` : "Seleccioná una categoría primero"}
                disabled={!selectedCatId}
                className="flex-1 bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#444] px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleAddSub}
                disabled={savingSub || !newSubName.trim() || !selectedCatId}
                className="px-3 py-2 bg-gold text-black hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <ul className="divide-y divide-luxury-gray">
            {!selectedCatId && (
              <li className="px-5 py-6 text-[#333] text-xs italic text-center">Seleccioná una categoría para ver sus subcategorías.</li>
            )}
            {selectedCatId && subsForSelected.length === 0 && (
              <li className="px-5 py-6 text-[#333] text-xs italic text-center">No hay subcategorías para esta categoría.</li>
            )}
            {subsForSelected.map((sub, subIndex) => {
              const isEditing = editingSubId === sub.id;
              return (
                <li
                  key={sub.id}
                  draggable={!isEditing}
                  onDragStart={(e) => handleSubDragStart(e, subIndex)}
                  onDragOver={(e) => handleSubDragOver(e, subIndex)}
                  onDragEnd={handleSubDragEnd}
                  className={`px-5 py-3 flex items-center gap-3 group hover:bg-[#111] transition-colors ${
                    dragSubOverIdx === subIndex ? "border-l-2 border-gold opacity-70" : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editSubName}
                        onChange={(e) => setEditSubName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveSub(sub.id);
                          if (e.key === "Escape") setEditingSubId(null);
                        }}
                        className="flex-1 bg-luxury-gray border border-gold text-white px-2 py-1 text-sm focus:outline-none"
                      />
                      <button onClick={() => handleSaveSub(sub.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                      <button onClick={() => setEditingSubId(null)} className="text-[#555] hover:text-white p-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <GripVertical size={14} className="text-[#333] shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${sub.activo ? "text-white" : "text-[#444] line-through"}`}>{sub.nombre}</p>
                        <p className="text-[#444] text-[10px] mt-0.5">{sub.slug}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleSubActivo(sub)}
                          className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                            sub.activo ? "border-green-500/30 text-green-500 hover:bg-green-500/10" : "border-[#333] text-[#555] hover:text-white"
                          }`}
                        >
                          {sub.activo ? "ON" : "OFF"}
                        </button>
                        <button onClick={() => { setEditingSubId(sub.id); setEditSubName(sub.nombre); }} className="p-1.5 text-[#555] hover:text-gold transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteSub(sub.id)} className="p-1.5 text-[#555] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

    </div>

    {/* Modal de confirmación */}
    {confirmModal.open && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-md p-6 md:p-8">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <AlertTriangle size={22} />
            <h2 className="font-serif text-xl text-white">Confirmar eliminación</h2>
          </div>
          <p className="text-luxury-gray-light text-sm mb-6 leading-relaxed">{confirmModal.message}</p>
          <div className="flex gap-3">
            <button
              onClick={closeConfirm}
              className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmModal.onConfirm}
              className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600/90 hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
