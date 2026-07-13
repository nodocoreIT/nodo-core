"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Producto } from "@/types";
import CustomSelect from "@/components/ui/CustomSelect";

import { 
  Plus, 
  Trash2, 
  Star, 
  ImagePlus, 
  Loader2, 
  X,
  ChevronRight,
  ChevronLeft,
  AlertTriangle
} from "lucide-react";
import Image from "next/image";

interface Props {
  producto?: Partial<Producto>;
  isEdit?: boolean;
}


const supabase = createClient();

function generateSlug(nombre: string, marca: string) {
  return `${nombre}-${marca}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function ProductoForm({ producto = {}, isEdit = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categoriasDb, setCategoriasDb] = useState<{id: string, nombre: string}[]>([]);
  const [subcategoriasDb, setSubcategoriasDb] = useState<{id: string, nombre: string}[]>([]);
  const [proveedoresDb, setProveedoresDb] = useState<{id: string, nombre: string}[]>([]);
  const [loadingSubcategorias, setLoadingSubcategorias] = useState(false);

  const [form, setForm] = useState({
    nombre: producto.nombre || "",
    marca: producto.marca || "",
    descripcion: producto.descripcion || "",
    descripcion_corta: producto.descripcion_corta || "",
    precio_costo: producto.precio_costo?.toString() || "",
    precio_venta: producto.precio_venta?.toString() || "",
    stock: producto.stock?.toString() || "0",
    imagen_url: producto.imagen_url || "",
    imagenes_adicionales: producto.imagenes_adicionales || [],
    categoria_id: producto.categoria_id?.toString() || "",
    categoria_nombre: producto.categoria || "",
    subcategoria_id: producto.subcategoria_id?.toString() || "",
    moneda: (producto.moneda as 'ARS' | 'USD') || 'ARS',
    proveedor_id: producto.proveedor_id?.toString() || "",
    activo: producto.activo !== undefined ? producto.activo : true,
    destacado: producto.destacado || false,
    nuevo: producto.nuevo || false,
    pedido: producto.pedido || false,
    meta_titulo: producto.meta_titulo || "",
    meta_descripcion: producto.meta_descripcion || "",
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeleteImagesModalOpen, setIsDeleteImagesModalOpen] = useState(false);

  useEffect(() => {
    async function fetchCategorias() {
      const { data, error } = await supabase.from("categorias").select("id, nombre").order("nombre");
      
      if (error) {
        console.error("Error cargando categorías de la DB:", error);
      } else if (data) {
        setCategoriasDb(data);
        
        // Sincronizar el nombre de la categoría si tenemos el ID (caso edición)
        if (form.categoria_id) {
          const found = data.find(c => c.id.toString() === form.categoria_id.toString());
          if (found) {
            setForm(prev => ({ ...prev, categoria_nombre: found.nombre }));
          }
        } else if (producto.categoria) {
          // Fallback si vino el nombre pero no el ID
          const found = data.find(c => c.nombre.toLowerCase() === producto.categoria?.toLowerCase());
          if (found) {
            setForm(prev => ({ ...prev, categoria_id: found.id, categoria_nombre: found.nombre }));
          }
        }
      }
    }

    fetchCategorias();
  }, [producto.id, form.categoria_id]);

  useEffect(() => {
    if (!form.categoria_id) {
      setSubcategoriasDb([]);
      return;
    }
    async function fetchSubcategorias() {
      setLoadingSubcategorias(true);
      const { data, error } = await supabase
        .from("subcategorias")
        .select("id, nombre")
        .eq("categoria_id", form.categoria_id)
        .eq("activo", true)
        .order("orden");
      if (error) {
        console.error("Error cargando subcategorías:", error);
      } else {
        setSubcategoriasDb(data || []);
      }
      setLoadingSubcategorias(false);
    }
    fetchSubcategorias();
  }, [form.categoria_id]);

  useEffect(() => {
    async function fetchProveedores() {
      const { data } = await supabase
        .from('proveedores')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
      setProveedoresDb(data || [])
    }
    fetchProveedores()
  }, [])

  function update(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const nombreTrimmed = form.nombre.trim();
    const marcaTrimmed = form.marca.trim();
    const payload = {
      nombre: nombreTrimmed,
      marca: marcaTrimmed,
      slug: generateSlug(nombreTrimmed, marcaTrimmed),
      descripcion: form.descripcion.trim(),
      descripcion_corta: form.descripcion_corta.trim() || null,
      precio_costo: form.precio_costo ? parseFloat(form.precio_costo) : null,
      precio_venta: parseFloat(form.precio_venta),
      stock: parseInt(form.stock) || 0,
      imagen_url: form.imagen_url.trim() || null,
      categoria_id: form.categoria_id || null,
      subcategoria_id: form.subcategoria_id || null,
      moneda: form.moneda,
      proveedor_id: form.proveedor_id || null,
      activo: form.activo,
      destacado: form.destacado,
      nuevo: form.nuevo,
      pedido: form.pedido,
      meta_titulo: form.meta_titulo.trim() || null,
      meta_descripcion: form.meta_descripcion.trim() || null,
      imagenes_adicionales: form.imagenes_adicionales,
    };

    let result;
    if (isEdit && producto.id) {
      result = await supabase.from("productos").update(payload).eq("id", producto.id);
    } else {
      result = await supabase.from("productos").insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setSuccess(isEdit ? "Producto actualizado correctamente." : "Producto creado correctamente.");
    router.refresh();
    setTimeout(() => router.back(), 1500);
  }

  const margen =
    form.precio_costo && form.precio_venta
      ? Math.round(
          ((parseFloat(form.precio_venta) - parseFloat(form.precio_costo)) /
            parseFloat(form.precio_venta)) *
            100
        )
      : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white">
          {isEdit ? "Editar Producto" : "Nuevo Producto"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos básicos */}
        <div className="bg-luxury-black border border-luxury-gray p-6 space-y-4">
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase mb-4">
            Información del Producto
          </h2>

          <div className="mb-4">
            <CustomSelect
              label="Categoría *"
              value={form.categoria_id}
              onChange={(val) => {
                const name = categoriasDb.find(c => c.id === val)?.nombre || "";
                setForm(prev => ({ ...prev, categoria_id: val, categoria_nombre: name, subcategoria_id: "" }));
              }}
              options={categoriasDb.map((c) => ({ value: c.id, label: c.nombre }))}
            />
          </div>

          {form.categoria_id && subcategoriasDb.length > 0 && (
            <div className="mb-6">
              <CustomSelect
                label="Subcategoría"
                value={form.subcategoria_id}
                loading={loadingSubcategorias}
                placeholder="Seleccionar subcategoría..."
                onChange={(val) => setForm(prev => ({ ...prev, subcategoria_id: val === "__none__" ? "" : val }))}
                options={[
                  { value: "__none__", label: "— Sin subcategoría —" },
                  ...subcategoriasDb.map((s) => ({ value: s.id, label: s.nombre })),
                ]}
              />
            </div>
          )}

          {proveedoresDb.length > 0 && (
            <div className="mb-4">
              <CustomSelect
                label="Proveedor"
                value={form.proveedor_id}
                placeholder="Seleccionar proveedor..."
                onChange={(val) => setForm(prev => ({ ...prev, proveedor_id: val === "__none__" ? "" : val }))}
                options={[
                  { value: "__none__", label: "— Sin proveedor —" },
                  ...proveedoresDb.map((p) => ({ value: p.id, label: p.nombre })),
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => update("nombre", e.target.value)}
                required
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
              />
            </div>
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Marca *
              </label>
              <input
                type="text"
                value={form.marca}
                onChange={(e) => update("marca", e.target.value)}
                required
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => update("descripcion", e.target.value)}
              rows={4}
              className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
              Descripción Corta
            </label>
            <input
              type="text"
              value={form.descripcion_corta}
              onChange={(e) => update("descripcion_corta", e.target.value)}
              maxLength={500}
              className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
            />
          </div>

        </div>

        {/* Gestión de Imágenes */}
        <div className="bg-luxury-black border border-luxury-gray p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gold text-xs tracking-[0.2em] uppercase">
              Galería de Imágenes
            </h2>
            <div className="flex items-center gap-3">
              {selectedImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDeleteImagesModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                  Eliminar ({selectedImages.length})
                </button>
              )}
              <label className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${uploading ? "bg-luxury-gray text-[#555555]" : "bg-gold text-black hover:bg-gold-light"}`}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {uploading ? "Subiendo..." : "Subir Imágenes"}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    
                    setUploading(true);
                    const newImages: string[] = [];
                    
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                      const filePath = `productos/${fileName}`;
                      
                      const { error: uploadError } = await supabase.storage
                        .from('productos')
                        .upload(filePath, file);
                        
                      if (uploadError) {
                        console.error("Error subiendo imagen:", uploadError);
                        continue;
                      }
                      
                      const { data: { publicUrl } } = supabase.storage
                        .from('productos')
                        .getPublicUrl(filePath);
                        
                      newImages.push(publicUrl);
                    }
                    
                    setForm(prev => {
                      let updatedPrincipal = prev.imagen_url;
                      let imagesToAdd = newImages;

                      if (!updatedPrincipal && newImages.length > 0) {
                        updatedPrincipal = newImages[0];
                        imagesToAdd = newImages.slice(1);
                      }

                      const updatedAdicionales = [...prev.imagenes_adicionales, ...imagesToAdd];
                      return {
                        ...prev,
                        imagenes_adicionales: updatedAdicionales,
                        imagen_url: updatedPrincipal
                      };
                    });
                    setUploading(false);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Grilla de Imágenes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {/* Todas las imágenes (adicionales + principal si no está en la lista) */}
            {Array.from(new Set([form.imagen_url, ...form.imagenes_adicionales])).filter(img => img).map((img, idx) => (
              <div key={idx} className={`group relative aspect-square bg-luxury-gray border overflow-hidden rounded-sm transition-all ${selectedImages.includes(img) ? "border-red-500 ring-1 ring-red-500" : "border-luxury-gray-mid"}`}>
                <Image
                  src={img}
                  alt={`Imagen ${idx}`}
                  fill
                  className="object-contain p-2"
                />
                
                {/* Checkbox de Selección */}
                <div className={`absolute top-2 right-2 z-10 transition-opacity ${selectedImages.includes(img) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  <input
                    type="checkbox"
                    checked={selectedImages.includes(img)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedImages(prev => [...prev, img]);
                      } else {
                        setSelectedImages(prev => prev.filter(i => i !== img));
                      }
                    }}
                    className="w-4 h-4 rounded border-gold text-gold focus:ring-gold bg-black/50"
                  />
                </div>

                {/* Overlay de Portada */}
                {form.imagen_url === img && (
                  <div className="absolute top-2 left-2 bg-gold text-black px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-sm z-10">
                    Portada
                  </div>
                )}

                {/* Acciones Hover */}
                {!selectedImages.includes(img) && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => update("imagen_url", img)}
                      className={`p-1.5 rounded-full transition-colors ${form.imagen_url === img ? "text-gold bg-white" : "text-white bg-white/10 hover:bg-white/20"}`}
                      title="Elegir como portada"
                    >
                      <Star size={14} fill={form.imagen_url === img ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(prev => {
                          const isPrincipal = prev.imagen_url === img;
                          const filteredAdicionales = prev.imagenes_adicionales.filter(i => i !== img);
                          let nextPrincipal = prev.imagen_url;
                          
                          if (isPrincipal) {
                            nextPrincipal = filteredAdicionales.length > 0 ? filteredAdicionales[0] : "";
                          }
                          
                          return {
                            ...prev,
                            imagen_url: nextPrincipal,
                            imagenes_adicionales: filteredAdicionales
                          };
                        });
                      }}
                      className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                      title="Eliminar imagen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Placeholder vacío si no hay imágenes */}
            {(!form.imagen_url && form.imagenes_adicionales.length === 0) && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-luxury-gray-mid text-[#333333]">
                <ImagePlus size={32} className="mb-2 opacity-20" />
                <p className="text-xs italic">No hay imágenes cargadas aún.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-luxury-gray">
            <p className="text-[#555555] text-[10px] leading-relaxed italic">
              * La imagen marcada con la estrella dorada será la que se muestre en el catálogo principal. <br/>
              * Podés subir múltiples imágenes a la vez. El sistema optimizará la carga.
            </p>
          </div>
        </div>

        {/* Precios */}
        <div className="bg-luxury-black border border-luxury-gray p-6 space-y-4">
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase mb-4">
            Precios & Stock
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Precio Costo ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.precio_costo}
                onChange={(e) => update("precio_costo", e.target.value)}
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Moneda
              </label>
              <div className="flex gap-2">
                {(['ARS', 'USD'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update("moneda", m)}
                    className={`flex-1 py-3 text-sm font-bold tracking-wider border transition-colors ${
                      form.moneda === m
                        ? 'bg-gold border-gold text-black'
                        : 'bg-luxury-gray border-luxury-gray-mid text-luxury-gray-light hover:border-gold'
                    }`}
                  >
                    {m === 'ARS' ? '$ Pesos' : 'US$ Dólares'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Precio Venta ({form.moneda === 'USD' ? 'US$' : '$'}) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.precio_venta}
                onChange={(e) => update("precio_venta", e.target.value)}
                required
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
                Stock *
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => update("stock", e.target.value)}
                required
                min="0"
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
              />
            </div>
          </div>

          {margen !== null && (
            <div
              className={`text-sm px-4 py-2.5 border ${
                margen >= 40
                  ? "border-green-400/30 text-green-400 bg-green-400/5"
                  : margen >= 25
                  ? "border-yellow-400/30 text-yellow-400 bg-yellow-400/5"
                  : "border-red-400/30 text-red-400 bg-red-400/5"
              }`}
            >
              Margen de ganancia: <strong>{margen}%</strong>
              {margen < 25 && " — ¡Revisar precio!"}
              {margen >= 40 && " — Excelente margen"}
            </div>
          )}
        </div>

        {/* Opciones */}
        <div className="bg-luxury-black border border-luxury-gray p-6">
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase mb-4">
            Visibilidad
          </h2>
          <div className="flex flex-wrap gap-6">
            {[
              { key: "activo", label: "Activo (visible en tienda)" },
              { key: "destacado", label: "Destacado en Home" },
              { key: "nuevo", label: "Marcar como Nuevo" },
              { key: "pedido", label: "Se trae por pedido (48hs)" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => update(key, e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
                <span className="text-[#cccccc] text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* SEO */}
        <div className="bg-luxury-black border border-luxury-gray p-6 space-y-4">
          <h2 className="text-gold text-xs tracking-[0.2em] uppercase mb-4">
            SEO (opcional — se genera automáticamente)
          </h2>
          <div>
            <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
              Meta Título ({form.meta_titulo.length}/160)
            </label>
            <input
              type="text"
              value={form.meta_titulo}
              onChange={(e) => update("meta_titulo", e.target.value)}
              maxLength={160}
              className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors"
            />
          </div>
          <div>
            <label className="text-luxury-gray-light text-xs uppercase tracking-widest block mb-1.5">
              Meta Descripción ({form.meta_descripcion.length}/320)
            </label>
            <textarea
              value={form.meta_descripcion}
              onChange={(e) => update("meta_descripcion", e.target.value)}
              maxLength={320}
              rows={3}
              className="w-full bg-luxury-gray border border-luxury-gray-mid text-white px-4 py-3 focus:outline-none focus:border-gold text-sm transition-colors resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 px-4 py-3">
            {error}
          </div>
        )}
        {success && (
          <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 px-4 py-3">
            {success}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gold text-black font-bold py-4 tracking-[0.2em] text-sm uppercase hover:bg-gold-light transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEdit ? "GUARDAR CAMBIOS" : "CREAR PRODUCTO"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="px-8 py-4 bg-transparent border border-luxury-gray-mid text-luxury-gray-light font-bold text-sm tracking-[0.2em] hover:text-white hover:border-white transition-all duration-300 disabled:opacity-50"
          >
            CANCELAR
          </button>
        </div>
      </form>

      {/* Overlay de Carga Full Screen */}
      {loading && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
              <Loader2 className="absolute inset-0 m-auto text-gold animate-pulse" size={24} />
            </div>
            <div className="flex flex-col items-center">
              <p className="text-gold font-serif text-xl tracking-widest animate-pulse">
                {isEdit ? "ACTUALIZANDO" : "CREANDO"}
              </p>
              <p className="text-[#555555] text-[10px] uppercase tracking-[0.3em] mt-1">
                Por favor, esperá un momento
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminación masiva de imágenes */}
      {isDeleteImagesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-md p-6 md:p-8">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h2 className="font-serif text-xl text-white">Confirmar eliminación</h2>
            </div>
            <p className="text-luxury-gray-light text-sm mb-6 leading-relaxed">
              ¿Estás seguro que deseas eliminar <strong className="text-white">{selectedImages.length} imágenes</strong> seleccionadas? Esta acción quitará las fotos de la galería del producto.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteImagesModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setForm(prev => {
                    const newAdicionales = prev.imagenes_adicionales.filter(img => !selectedImages.includes(img));
                    let newPrincipal = prev.imagen_url;
                    
                    if (selectedImages.includes(prev.imagen_url)) {
                      newPrincipal = newAdicionales.length > 0 ? newAdicionales[0] : "";
                    }
                    
                    return {
                      ...prev,
                      imagenes_adicionales: newAdicionales,
                      imagen_url: newPrincipal
                    };
                  });
                  setSelectedImages([]);
                  setIsDeleteImagesModalOpen(false);
                }}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600/90 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Trash2 size={14} />
                Eliminar {selectedImages.length} {selectedImages.length === 1 ? 'imagen' : 'imágenes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
