"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Producto } from "@/types";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileSpreadsheet,
  ArrowDown,
  ArrowUp,
  X,
  Images,
  Wand2,
} from "lucide-react";
import BulkImportModal from "./BulkImportModal";
import BulkImagenesModal from "./BulkImagenesModal";
import * as XLSX from "xlsx";
import CustomSelect from "@/components/ui/CustomSelect";
import toast from "react-hot-toast";

interface Stats {
  total: number;
  activos: number;
  sinStock: number;
  valorInventario: number;
  margenPromedio: number;
}

interface Props {
  productos: Producto[];
}

export default function DashboardClient({ productos: initialProductos }: Props) {
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>(initialProductos);
  const [loading, setLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [busqueda, setBusqueda] = useState(searchParams.get('q') ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: "", nombre: "" });
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [bulkImagenesModal, setBulkImagenesModal] = useState(false);
  const [categoriaFiltrada, setCategoriaFiltrada] = useState<string>(searchParams.get('cat') ?? "");
  const [subcategoriaFiltrada, setSubcategoriaFiltrada] = useState<string>(searchParams.get('sub') ?? "");
  const [menuBulkAbierto, setMenuBulkAbierto] = useState<"categoria" | "subcategoria" | null>(null);
  const [precioModal, setPrecioModal] = useState<{ open: boolean; venta: string; costo: string }>({ open: false, venta: "", costo: "" });
  const [categoriasDb, setCategoriasDb] = useState<{id: string, nombre: string}[]>([]);
  const [subcategoriasDb, setSubcategoriasDb] = useState<{id: string, nombre: string, slug: string, categoria_id: string}[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [removeBgProgress, setRemoveBgProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function fetchProductos() {
    try {
      setBulkLoading(true);
      // Cargamos categorías y productos en paralelo para máxima eficiencia
      const [{ data: cats }, { data: prods }, { data: provs }] = await Promise.all([
        supabase.from("categorias").select("id, nombre"),
        supabase.from("productos").select("*").order("created_at", { ascending: false }),
        supabase.from("proveedores").select("id, nombre"),
      ]);

      if (!prods) return;

      const catMap = new Map(cats?.map(c => [c.id.toString(), c.nombre]) || []);
      const provMap = new Map(provs?.map(p => [p.id.toString(), p.nombre]) || []);

      const formattedData = (prods as any[]).map(p => ({
        ...p,
        categoria: p.categoria_id ? (catMap.get(p.categoria_id.toString()) || "Fragancias") : (p.categoria || "Fragancias"),
        proveedores: p.proveedor_id ? { nombre: provMap.get(p.proveedor_id.toString()) ?? null } : null,
      }));

      setProductos(formattedData as Producto[]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  const fetchCategorias = async () => {
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from("categorias").select("id, nombre"),
      supabase.from("subcategorias").select("id, nombre, slug, categoria_id").eq("activo", true).order("orden"),
    ]);
    if (cats) setCategoriasDb(cats);
    if (subs) setSubcategoriasDb(subs);
  };

  useEffect(() => {
    fetchCategorias();
    fetchProductos();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (busqueda) params.set('q', busqueda);
    if (categoriaFiltrada) params.set('cat', categoriaFiltrada);
    if (subcategoriaFiltrada) params.set('sub', subcategoriaFiltrada);
    const qs = params.toString();
    router.replace(`/dashboard${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [busqueda, categoriaFiltrada, subcategoriaFiltrada]);

  // Cálculos de estadísticas en tiempo real
  const currentStats = {
    total: productos.length,
    activos: productos.filter((p) => p.activo).length,
    sinStock: productos.filter((p) => p.stock === 0).length,
    valorInventario: productos.reduce((sum, p) => sum + (p.precio_costo || 0) * p.stock, 0),
    margenPromedio: (() => {
      const conCosto = productos.filter((p) => p.precio_costo && p.precio_costo > 0);
      if (conCosto.length === 0) return 0;
      const total = conCosto.reduce(
        (sum, p) => sum + ((p.precio_venta - (p.precio_costo || 0)) / p.precio_venta) * 100,
        0
      );
      return Math.round(total / conCosto.length);
    })(),
  };

  // Multi-select logic
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === productosFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productosFiltrados.map((p) => p.id)));
    }
  };

  async function toggleActivo(id: string, activo: boolean) {
    setLoading(id);
    await supabase.from("productos").update({ activo: !activo }).eq("id", id);
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, activo: !activo } : p))
    );
    setLoading(null);
  }

  async function bulkToggleActivo(activo: boolean) {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    await supabase.from("productos").update({ activo }).in("id", ids);
    setProductos((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, activo } : p))
    );
    setSelectedIds(new Set());
    setBulkLoading(false);
    toast.success(`Se actualizaron ${ids.length} productos.`);
  }
  
  async function bulkUpdateField(field: "categoria", value: string) {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    
    let updateData: any = { [field]: value };
    
    // Si es categoría, buscamos el ID correspondiente
    if (field === "categoria") {
      console.log("Categorías en DB:", categoriasDb);
      console.log("Buscando categoría:", value);
      
      const catEncontrada = categoriasDb.find(c => c.nombre.toLowerCase().trim() === value.toLowerCase().trim());
      
      if (catEncontrada) {
        console.log("Categoría encontrada!", catEncontrada);
        updateData = { 
          categoria_id: catEncontrada.id,
          categoria: catEncontrada.nombre
        };
      } else {
        console.error("No se encontró la categoría con nombre:", value);
        toast.error(`No se encontró la categoría '${value}' en la base de datos.`);
        setBulkLoading(false);
        return;
      }
    }

    // 2. Preparamos lo que se guarda en DB (solo columnas reales)
    const dbPayload = { ...updateData };
    delete (dbPayload as any).categoria; // No existe en DB

    const { error } = await supabase.from("productos").update(dbPayload).in("id", ids);
    
    if (error) {
      console.error("Error Supabase:", error);
      toast.error("Error al actualizar productos.");
    } else {
      setProductos((prev) =>
        prev.map((p) => (selectedIds.has(p.id) ? { ...p, ...updateData } : p))
      );
      setSelectedIds(new Set());
      toast.success("Productos actualizados correctamente.");
    }
    setBulkLoading(false);
  }

  async function bulkUpdateSubcategoria(subId: string, catId: string) {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("productos")
      .update({ subcategoria_id: subId, categoria_id: catId })
      .in("id", ids);
    if (error) {
      toast.error("Error al actualizar subcategoría.");
    } else {
      setProductos((prev) =>
        prev.map((p) => selectedIds.has(p.id) ? { ...p, subcategoria_id: subId, categoria_id: catId } : p)
      );
      setSelectedIds(new Set());
      toast.success("Subcategoría actualizada correctamente.");
    }
    setBulkLoading(false);
  }

  async function bulkUpdatePrecios() {
    const { venta, costo } = precioModal;
    if (!venta && !costo) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const payload: Record<string, number> = {};
    if (venta) payload.precio_venta = Number(venta.replace(/\D/g, ""));
    if (costo) payload.precio_costo = Number(costo.replace(/\D/g, ""));
    const { error } = await supabase.from("productos").update(payload).in("id", ids);
    if (error) {
      toast.error("Error al actualizar precios.");
    } else {
      setProductos((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, ...payload } : p));
      setSelectedIds(new Set());
      setPrecioModal({ open: false, venta: "", costo: "" });
      toast.success(`Precios actualizados en ${ids.length} productos.`);
    }
    setBulkLoading(false);
  }

  function handleImagesSaved(id: string, imagen_url: string | null, imagenes_adicionales: string[]) {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, imagen_url: imagen_url ?? undefined, imagenes_adicionales } : p))
    );
  }

  async function ejecutarEliminarBulk() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    await supabase.from("productos").delete().in("id", ids);
    setProductos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setBulkLoading(false);
    setBulkDeleteModal(false);
    toast.success("Productos eliminados correctamente.");
  }

  const downloadExcel = (data?: Producto[]) => {
    const toExport = data || productos.filter((p) => selectedIds.has(p.id));
    if (toExport.length === 0) return;

    const exportData = toExport.map((p) => ({
      nombre: p.nombre,
      marca: p.marca,
      categoria: p.categoria || "",
      precio_costo: p.precio_costo || 0,
      precio_venta: p.precio_venta || 0,
      stock: p.stock || 0,
      imagen_url: p.imagen_url || "",
      activo: p.activo ? "SI" : "NO",
      destacado: p.destacado ? "SI" : "NO",
      nuevo: p.nuevo ? "SI" : "NO",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, `export_productos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  function confirmarEliminar(id: string, nombre: string) {
    setDeleteModal({ isOpen: true, id, nombre });
  }

  async function ejecutarEliminar() {
    if (!deleteModal.id) return;
    setLoading(deleteModal.id);
    await supabase.from("productos").delete().eq("id", deleteModal.id);
    setProductos((prev) => prev.filter((p) => p.id !== deleteModal.id));
    setLoading(null);
    setDeleteModal({ isOpen: false, id: "", nombre: "" });
    toast.success("Producto eliminado.");
  }

  async function handleRemoveBg() {
    const targets = productos.filter(p => selectedIds.has(p.id) && p.imagen_url);
    if (targets.length === 0) {
      toast.error("Ningún producto seleccionado tiene imagen.");
      return;
    }
    setRemoveBgProgress({ done: 0, total: targets.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      try {
        const res = await fetch('/api/remove-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: p.imagen_url, productId: p.id }),
        });
        const json = await res.json();
        if (res.ok && json.publicUrl) {
          setProductos(prev => prev.map(x => x.id === p.id ? { ...x, imagen_url: json.publicUrl } : x));
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
      setRemoveBgProgress({ done: i + 1, total: targets.length, errors });
    }
    const ok = targets.length - errors;
    toast.success(`Fondo eliminado en ${ok} producto${ok !== 1 ? 's' : ''}${errors ? ` (${errors} errores)` : ''}.`);
    setRemoveBgProgress(null);
    setSelectedIds(new Set());
  }

  const catSeleccionada = categoriasDb.find(c => c.nombre === categoriaFiltrada);
  const subcategoriasParaCategoria = catSeleccionada
    ? subcategoriasDb.filter(s => s.categoria_id === catSeleccionada.id)
    : [];

  const productosFiltrados = productos.filter((p) => {
    // 1. Filtro por búsqueda
    const matchesBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.marca.toLowerCase().includes(busqueda.toLowerCase());

    // 2. Filtro por categoría
    const cat = p.categoria || "Fragancias";
    const matchesCategoria = !categoriaFiltrada || cat === categoriaFiltrada;

    // 3. Filtro por subcategoría
    const matchesSubcategoria = !subcategoriaFiltrada || (p as any).subcategoria_id === subcategoriaFiltrada;

    return matchesBusqueda && matchesCategoria && matchesSubcategoria;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aValue: any = a[sortConfig.key as keyof Producto];
    let bValue: any = b[sortConfig.key as keyof Producto];

    // Casos especiales para campos virtuales o anidados
    if (sortConfig.key === "categoria") {
      aValue = a.categoria || "Fragancias";
      bValue = b.categoria || "Fragancias";
    }

    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-luxury-black border border-luxury-gray p-5">
          <div className="flex items-center gap-2 text-luxury-gray-light text-xs mb-2">
            <Package size={14} /> TOTAL
          </div>
          <p className="text-white font-bold text-2xl">{currentStats.total}</p>
          <p className="text-[#555555] text-xs">productos</p>
        </div>
        <div className="bg-luxury-black border border-luxury-gray p-5">
          <div className="flex items-center gap-2 text-gold text-xs mb-2">
            <Eye size={14} /> ACTIVOS
          </div>
          <p className="text-white font-bold text-2xl">{currentStats.activos}</p>
          <p className="text-[#555555] text-xs">publicados</p>
        </div>
        <div className="bg-luxury-black border border-luxury-gray p-5">
          <div className="flex items-center gap-2 text-orange-400 text-xs mb-2">
            <AlertTriangle size={14} /> SIN STOCK
          </div>
          <p className="text-white font-bold text-2xl">{currentStats.sinStock}</p>
          <p className="text-[#555555] text-xs">para reponer</p>
        </div>
        <div className="bg-luxury-black border border-luxury-gray p-5">
          <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
            <DollarSign size={14} /> INVENTARIO
          </div>
          <p className="text-white font-bold text-2xl">
            ${currentStats.valorInventario.toLocaleString("es-AR")}
          </p>
          <p className="text-[#555555] text-xs">valor costo</p>
        </div>
        <div className="bg-luxury-black border border-luxury-gray p-5">
          <div className="flex items-center gap-2 text-gold text-xs mb-2">
            <TrendingUp size={14} /> MARGEN
          </div>
          <p className="text-white font-bold text-2xl">{currentStats.margenPromedio}%</p>
          <p className="text-[#555555] text-xs">promedio</p>
        </div>
      </div>

      {/* Toolbar — fila 1: filtros + importar/exportar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o marca..."
            className="bg-luxury-black border border-luxury-gray-mid text-white placeholder-[#555555] px-4 py-2.5 focus:outline-none focus:border-gold transition-colors text-sm w-full sm:w-72"
          />
          <div className="w-full sm:w-44">
            <CustomSelect
              value={categoriaFiltrada}
              onChange={(val) => { setCategoriaFiltrada(val); setSubcategoriaFiltrada(""); }}
              options={[
                { value: "", label: "Ver Todo" },
                ...categoriasDb.map(c => ({ value: c.nombre, label: c.nombre })),
              ]}
              placeholder="Categoría"
            />
          </div>
          {subcategoriasParaCategoria.length > 0 && (
            <div className="w-full sm:w-40">
              <CustomSelect
                value={subcategoriaFiltrada}
                onChange={(val) => setSubcategoriaFiltrada(val)}
                options={[
                  { value: "", label: "Todas" },
                  ...subcategoriasParaCategoria.map(s => ({ value: s.id, label: s.nombre })),
                ]}
                placeholder="Subcategoría"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard/nuevo"
            className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2.5 text-sm tracking-wider hover:bg-gold-light transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            Nuevo
          </Link>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-luxury-gray text-white border border-luxury-gray-mid font-bold px-4 py-2.5 text-sm tracking-wider hover:bg-[#252525] transition-colors whitespace-nowrap group"
          >
            <div className="relative flex items-center">
              <FileSpreadsheet size={16} className="text-gold" />
              <ArrowDown size={10} className="text-white absolute -right-1 -bottom-1 bg-luxury-gray rounded-full group-hover:translate-y-0.5 transition-transform" />
            </div>
            Importar
          </button>
          <button
            onClick={() => downloadExcel(productosFiltrados)}
            className="flex items-center gap-2 bg-luxury-gray text-white border border-luxury-gray-mid font-bold px-4 py-2.5 text-sm tracking-wider hover:bg-[#252525] transition-colors whitespace-nowrap group"
          >
            <div className="relative flex items-center">
              <FileSpreadsheet size={16} className="text-gold" />
              <ArrowUp size={10} className="text-white absolute -right-1 -bottom-1 bg-luxury-gray rounded-full group-hover:-translate-y-0.5 transition-transform" />
            </div>
            Exportar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-luxury-black border border-luxury-gray overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-luxury-gray bg-black/30">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === productosFiltrados.length && productosFiltrados.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-luxury-gray-mid bg-black text-gold focus:ring-gold"
                  />
                </th>
                <th 
                  className="text-left text-[#555555] text-xs tracking-widest uppercase px-4 py-3 cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("nombre")}
                >
                  <div className="flex items-center gap-2">
                    Producto
                    <span className={`transition-all ${sortConfig?.key === "nombre" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "nombre" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th 
                  className="text-left text-[#555555] text-xs tracking-widest uppercase px-4 py-3 hidden lg:table-cell cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("categoria")}
                >
                  <div className="flex items-center gap-2">
                    Categoría
                    <span className={`transition-all ${sortConfig?.key === "categoria" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "categoria" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th
                  className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3 cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("precio_costo")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Costo
                    <span className={`transition-all ${sortConfig?.key === "precio_costo" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "precio_costo" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th
                  className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3 cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("precio_venta")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Venta
                    <span className={`transition-all ${sortConfig?.key === "precio_venta" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "precio_venta" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3 hidden md:table-cell">Proveedor</th>
                <th 
                  className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3 cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("stock")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Stock
                    <span className={`transition-all ${sortConfig?.key === "stock" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "stock" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th 
                  className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3 cursor-pointer hover:text-white transition-colors group"
                  onClick={() => handleSort("activo")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Estado
                    <span className={`transition-all ${sortConfig?.key === "activo" ? "opacity-100 text-gold" : "opacity-30 text-white"}`}>
                      {sortConfig?.key === "activo" && sortConfig.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </span>
                  </div>
                </th>
                <th className="text-center text-[#555555] text-xs tracking-widest uppercase px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111111]">
              {productosFiltrados.map((producto) => {
                return (
                  <tr
                    key={producto.id}
                    className={`hover:bg-[#111111] transition-colors ${!producto.activo ? "opacity-50" : ""} ${selectedIds.has(producto.id) ? "bg-gold/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(producto.id)}
                        onChange={() => toggleSelect(producto.id)}
                        className="w-4 h-4 rounded border-luxury-gray-mid bg-black text-gold focus:ring-gold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {producto.imagen_url && (
                          <Image
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-cover shrink-0 hidden sm:block"
                          />
                        )}
                        <div>
                          <p className="text-white font-medium line-clamp-1">{producto.nombre}</p>
                          <p className="text-[#555555] text-xs">{producto.marca}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-luxury-gray-light text-xs hidden lg:table-cell">
                      {producto.categoria || "Fragancias"}
                    </td>
                    <td className="px-4 py-3 text-center text-luxury-gray-light">
                      {producto.precio_costo ? `${producto.moneda === 'USD' ? 'US$' : '$'} ${producto.precio_costo.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gold font-semibold">
                      {producto.moneda === 'USD' ? 'US$' : '$'} {producto.precio_venta.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-xs text-luxury-gray-light">
                        {producto.proveedores?.nombre ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold ${producto.stock > 5 ? "text-green-500" : producto.stock > 0 ? "text-amber-500" : "text-red-500"}`}>
                        {producto.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActivo(producto.id, producto.activo)}
                        disabled={loading === producto.id}
                        className={`text-xs px-3 py-1 font-bold transition-colors ${
                          producto.activo
                            ? "bg-green-500 text-black hover:bg-green-600"
                            : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                      >
                        {producto.activo ? "Activo" : "Oculto"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/productos/${producto.slug}`} target="_blank"
                          className="text-[#555555] hover:text-gold transition-colors" title="Ver en tienda">
                          <Eye size={14} />
                        </Link>
                        <Link href={`/dashboard/editar/${producto.id}`}
                          className="text-[#555555] hover:text-gold transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </Link>
                        <button
                          onClick={() => confirmarEliminar(producto.id, producto.nombre)}
                          disabled={loading === producto.id}
                          className="text-[#555555] hover:text-red-400 transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {productosFiltrados.length === 0 && (
            <div className="text-center py-12 text-[#555555]">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              <p>No hay productos que mostrar.</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-[#333333] text-xs mt-4 text-center">
        {productosFiltrados.length} de {productos.length} productos
      </p>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] bg-luxury-gray border border-gold/30 shadow-2xl px-6 py-4 flex items-center gap-6 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm">{selectedIds.size} seleccionados</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-gold text-[10px] uppercase tracking-wider hover:underline">Desmarcar todos</button>
          </div>
          <div className="h-8 w-px bg-luxury-gray-mid" />
          <div className="flex items-center gap-3">
            <button 
              onClick={() => downloadExcel()}
              className="px-3 py-1.5 text-xs font-bold text-gold border border-gold/20 hover:bg-gold/10 transition-colors flex items-center gap-2 group"
            >
              <div className="relative flex items-center">
                <FileSpreadsheet size={14} className="text-gold" />
                <ArrowUp size={8} className="text-white absolute -right-0.5 -bottom-0.5 bg-luxury-gray rounded-full group-hover:-translate-y-0.5 transition-transform" />
              </div>
              Exportar
            </button>
            <button 
              onClick={() => bulkToggleActivo(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs font-bold text-green-400 border border-green-400/20 hover:bg-green-400/10 transition-colors"
            >
              Mostrar
            </button>
            <button 
              onClick={() => bulkToggleActivo(false)}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs font-bold text-gray-400 border border-gray-400/20 hover:bg-gray-400/10 transition-colors"
            >
              Ocultar
            </button>

            <div className="h-6 w-px bg-luxury-gray-mid mx-1" />

            {/* Categoría Masiva */}
            <div className="relative">
              <button 
                onClick={() => setMenuBulkAbierto(menuBulkAbierto === "categoria" ? null : "categoria")}
                className={`px-3 py-1.5 text-xs font-bold border transition-colors ${menuBulkAbierto === "categoria" ? "bg-gold text-black border-gold" : "text-gold border-gold/20 hover:bg-gold/10"}`}
              >
                Categoría
              </button>
              {menuBulkAbierto === "categoria" && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setMenuBulkAbierto(null)} />
                  <div className="absolute bottom-full left-0 mb-2 bg-[#111111] border border-luxury-gray-mid shadow-2xl p-2 min-w-[160px] animate-fade-in-up">
                    {categoriasDb.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          bulkUpdateField("categoria", cat.nombre);
                          setMenuBulkAbierto(null);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] text-luxury-gray-light hover:text-white hover:bg-luxury-gray transition-colors"
                      >
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Subcategoría Masiva */}
            <div className="relative">
              <button
                onClick={() => setMenuBulkAbierto(menuBulkAbierto === "subcategoria" ? null : "subcategoria")}
                className={`px-3 py-1.5 text-xs font-bold border transition-colors ${menuBulkAbierto === "subcategoria" ? "bg-gold text-black border-gold" : "text-gold border-gold/20 hover:bg-gold/10"}`}
              >
                Subcategoría
              </button>
              {menuBulkAbierto === "subcategoria" && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setMenuBulkAbierto(null)} />
                  <div className="absolute bottom-full left-0 mb-2 bg-[#111111] border border-luxury-gray-mid shadow-2xl p-2 min-w-[200px] animate-fade-in-up max-h-72 overflow-y-auto">
                    {categoriasDb.map(cat => {
                      const subs = subcategoriasDb.filter(s => s.categoria_id === cat.id);
                      if (!subs.length) return null;
                      return (
                        <div key={cat.id}>
                          <p className="px-3 py-1 text-[9px] text-[#555555] uppercase tracking-widest font-bold">{cat.nombre}</p>
                          {subs.map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => {
                                bulkUpdateSubcategoria(sub.id, sub.categoria_id);
                                setMenuBulkAbierto(null);
                              }}
                              className="w-full text-left px-3 py-2 text-[10px] text-luxury-gray-light hover:text-white hover:bg-luxury-gray transition-colors pl-5"
                            >
                              {sub.nombre}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setPrecioModal({ open: true, venta: "", costo: "" })}
              className="px-3 py-1.5 text-xs font-bold text-blue-400 border border-blue-400/20 hover:bg-blue-400/10 transition-colors"
            >
              Precio
            </button>
            <button
              onClick={() => setBulkImagenesModal(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs font-bold text-purple-400 border border-purple-400/20 hover:bg-purple-400/10 transition-colors flex items-center gap-2"
            >
              <Images size={12} />
              Imágenes
            </button>
            <button
              onClick={handleRemoveBg}
              disabled={bulkLoading || !!removeBgProgress}
              className="px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/10 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Wand2 size={12} />
              {removeBgProgress
                ? `${removeBgProgress.done}/${removeBgProgress.total}`
                : 'Quitar fondo'}
            </button>
            <button
              onClick={() => setBulkDeleteModal(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs font-bold text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-colors flex items-center gap-2"
            >
              <Trash2 size={12} />
              Eliminar
            </button>
          </div>
          <div className="h-8 w-px bg-luxury-gray-mid" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[#555555] hover:text-white transition-colors p-1"
            title="Cerrar"
          >
            <X size={16} />
          </button>
          {bulkLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
              <div className="w-5 h-5 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Modal eliminación unitaria */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-md p-6 md:p-8">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h2 className="font-serif text-xl text-white">Confirmar eliminación</h2>
            </div>
            <p className="text-luxury-gray-light text-sm mb-6 leading-relaxed">
              ¿Estás seguro que deseas eliminar{" "}
              <strong className="text-gold">{deleteModal.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, id: "", nombre: "" })}
                className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
                disabled={loading === deleteModal.id}
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEliminar}
                disabled={loading === deleteModal.id}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600/90 hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
              >
                {loading === deleteModal.id ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminación masiva */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-md p-6 md:p-8">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h2 className="font-serif text-xl text-white">Eliminación Masiva</h2>
            </div>
            <p className="text-luxury-gray-light text-sm mb-6 leading-relaxed">
              ¿Estás seguro que deseas eliminar <strong className="text-white">{selectedIds.size} productos</strong> seleccionados? Esta acción es permanente y afectará a todo el catálogo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkDeleteModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
                disabled={bulkLoading}
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEliminarBulk}
                disabled={bulkLoading}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600/90 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {bulkLoading ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Eliminar {selectedIds.size} {selectedIds.size === 1 ? 'producto' : 'productos'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Actualización Masiva de Precios */}
      {precioModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-sm p-6 md:p-8">
            <h2 className="font-serif text-xl text-white mb-1">Actualizar precios</h2>
            <p className="text-[#555555] text-xs mb-6">
              {selectedIds.size} producto{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}. Dejá en blanco el campo que no querés modificar.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-luxury-gray-light text-xs uppercase tracking-widest mb-1.5">Precio de Venta</label>
                <input
                  type="number"
                  value={precioModal.venta}
                  onChange={(e) => setPrecioModal(prev => ({ ...prev, venta: e.target.value }))}
                  placeholder="Precio nuevo..."
                  className="w-full bg-[#111] border border-luxury-gray-mid text-white px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-luxury-gray-light text-xs uppercase tracking-widest mb-1.5">Precio de Costo</label>
                <input
                  type="number"
                  value={precioModal.costo}
                  onChange={(e) => setPrecioModal(prev => ({ ...prev, costo: e.target.value }))}
                  placeholder="Precio nuevo..."
                  className="w-full bg-[#111] border border-luxury-gray-mid text-white px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPrecioModal({ open: false, venta: "", costo: "" })}
                className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
                disabled={bulkLoading}
              >
                Cancelar
              </button>
              <button
                onClick={bulkUpdatePrecios}
                disabled={bulkLoading || (!precioModal.venta && !precioModal.costo)}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-gold text-black hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {bulkLoading ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : null}
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Imágenes Masivo */}
      {bulkImagenesModal && (
        <BulkImagenesModal
          productos={productos}
          selectedIds={selectedIds}
          onClose={() => setBulkImagenesModal(false)}
          onSaved={handleImagesSaved}
        />
      )}

      {/* Modal Importación Excel */}
      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchProductos();
          router.refresh();
        }}
      />
    </>
  );
}
