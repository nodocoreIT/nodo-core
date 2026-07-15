"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Download, Upload, X, Check, AlertCircle, FileText } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const templateData = [
      {
        nombre: "Ejemplo Producto",
        marca: "Marca Ejemplo",
        descripcion: "Descripción larga del producto...",
        precio_costo: 5000,
        precio_venta: 8500,
        stock: 10,
        categoria: "General",
        subcategoria: "Femeninos",
        activo: "SI"
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "plantilla_productos.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);
        
        if (rawData.length === 0) {
          setError("El archivo está vacío.");
          return;
        }
        
        setData(rawData);
      } catch (err) {
        setError("Error al leer el archivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const baseSlug = (nombre: string, marca: string) =>
    `${nombre}-${marca}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const processImport = async () => {
    if (data.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Obtener categorías y slugs existentes
      const [{ data: categoriasDb }, { data: subcategoriasDb }, { data: existingSlugs }] = await Promise.all([
        supabase.from("categorias").select("id, nombre"),
        supabase.from("subcategorias").select("id, nombre"),
        supabase.from("productos").select("slug"),
      ]);

      const categoriaMap = new Map(categoriasDb?.map(c => [c.nombre.toLowerCase(), c.id]));
      const subcategoriaMap = new Map(subcategoriasDb?.map(s => [s.nombre.toLowerCase(), s.id]));

      // Set de slugs ya usados (DB + los que vamos generando en este lote)
      const usedSlugs = new Set<string>((existingSlugs ?? []).map(r => r.slug));

      function uniqueSlug(nombre: string, marca: string): string {
        const base = baseSlug(nombre, marca);
        if (!usedSlugs.has(base)) {
          usedSlugs.add(base);
          return base;
        }
        let i = 2;
        while (usedSlugs.has(`${base}-${i}`)) i++;
        const slug = `${base}-${i}`;
        usedSlugs.add(slug);
        return slug;
      }

      // 2. Preparar datos para inserción
      const productosToInsert = data.map(item => {
        const catNombre = String(item.categoria || "").toLowerCase();
        const subNombre = String(item.subcategoria || "").toLowerCase();
        const catId = categoriaMap.get(catNombre) || null;
        const subId = subcategoriaMap.get(subNombre) || null;

        return {
          nombre: item.nombre,
          marca: item.marca,
          slug: uniqueSlug(String(item.nombre), String(item.marca)),
          descripcion: item.descripcion || "",
          precio_costo: Number(item.precio_costo) || 0,
          precio_venta: Number(item.precio_venta) || 0,
          stock: Number(item.stock) || 0,
          imagen_url: item.imagen_url || null,
          categoria_id: catId,
          subcategoria_id: subId,
          activo: item.activo === "SI" || item.activo === true,
          destacado: item.destacado === "SI" || item.destacado === true,
          nuevo: item.nuevo === "SI" || item.nuevo === true,
        };
      });

      // 3. Insertar en lotes de 20 para seguridad
      const batchSize = 20;
      for (let i = 0; i < productosToInsert.length; i += batchSize) {
        const batch = productosToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from("productos").insert(batch);
        if (insertError) throw insertError;
      }

      toast.success(`Se importaron ${productosToInsert.length} productos correctamente.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error detallado:", err);
      setError(err.message || "Error al importar productos.");
      toast.error("Hubo un error al realizar la importación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-luxury-gray flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10 rounded-lg">
              <Upload className="text-gold" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-serif text-white">Importar Catálogo</h2>
              <p className="text-luxury-gray-light text-xs">Carga masiva de productos desde Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#555555] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Download Template */}
          <div className="bg-luxury-black border border-luxury-gray p-4 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="text-luxury-gray-light" size={24} />
              <div>
                <p className="text-white text-sm font-medium">1. Descargar Plantilla</p>
                <p className="text-[#555555] text-xs">Usá nuestro formato oficial para evitar errores</p>
              </div>
            </div>
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-luxury-gray hover:bg-[#252525] text-white text-xs px-4 py-2 rounded border border-luxury-gray-mid transition-colors"
            >
              <Download size={14} /> Descargar .xlsx
            </button>
          </div>

          {/* Step 2: Upload File */}
          <div className="space-y-4">
            <p className="text-white text-sm font-medium">2. Subir Archivo Excel</p>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                file ? "border-green-500/50 bg-green-500/5" : "border-luxury-gray-mid hover:border-gold/50 hover:bg-gold/5"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              {file ? (
                <div className="space-y-2">
                  <Check className="mx-auto text-green-500" size={32} />
                  <p className="text-white text-sm font-medium">{file.name}</p>
                  <p className="text-green-500/70 text-xs">{data.length} productos detectados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto text-[#555555]" size={32} />
                  <p className="text-luxury-gray-light text-sm">Arrastrá el archivo aquí o hacé clic para buscar</p>
                  <p className="text-[#333333] text-xs">Formatos compatibles: .xlsx, .xls</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Preview Table */}
          {data.length > 0 && (
            <div className="space-y-3">
              <p className="text-white text-sm font-medium">Vista Previa (Primeros 5 items)</p>
              <div className="border border-luxury-gray rounded-lg overflow-hidden">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-black/50 text-[#555555] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Marca</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luxury-gray">
                    {data.slice(0, 5).map((item, i) => (
                      <tr key={i} className="text-luxury-gray-light">
                        <td className="px-3 py-2 text-white">{item.nombre}</td>
                        <td className="px-3 py-2 text-gold">{item.categoria || ""}</td>
                        <td className="px-3 py-2">{item.marca}</td>
                        <td className="px-3 py-2 text-right">${item.precio_venta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-luxury-gray flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            onClick={processImport}
            disabled={loading || data.length === 0}
            className="flex-1 bg-gold disabled:bg-gray-800 disabled:text-gray-500 text-black font-bold px-4 py-2.5 text-sm tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Importar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
