"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { bienestar, aromatizantes, skincare } from "@/constants/navigation";
import { Search, X, Loader2 } from "lucide-react";
import NoImagePlaceholder from "@/components/ui/NoImagePlaceholder";
import CustomSelect from "@/components/ui/CustomSelect";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/price-utils";
import type { Producto } from "@/types";

async function searchProductsInline(query: string): Promise<Producto[]> {
  if (query.length < 3) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, marca, slug, precio_venta, imagen_url")
    .eq("activo", true)
    .or(`nombre.ilike.%${query}%,marca.ilike.%${query}%`)
    .order("destacado", { ascending: false })
    .limit(6);
  return (data as Producto[]) || [];
}

const ordenOpciones = [
  { value: "", label: "RELEVANCIA" },
  { value: "precio_asc", label: "MENOR PRECIO" },
  { value: "precio_desc", label: "MAYOR PRECIO" },
  { value: "nombre", label: "NOMBRE A-Z" },
];

interface Subcategoria {
  id: string;
  nombre: string;
  slug: string;
}

interface Props {
  activeParams: Record<string, string | undefined>;
  subcategorias?: Subcategoria[];
}

export default function FiltrosCatalogo({ activeParams, subcategorias = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(activeParams.q || activeParams.busqueda || "");
  const [dropdownResults, setDropdownResults] = useState<Producto[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchValue(activeParams.q || activeParams.busqueda || "");
  }, [activeParams.q, activeParams.busqueda]);

  // Clear search when subcategory or category changes
  const prevSubcategoria = useRef(activeParams.subcategoria);
  const prevCategoria = useRef(activeParams.categoria);
  useEffect(() => {
    const subChanged = prevSubcategoria.current !== activeParams.subcategoria;
    const catChanged = prevCategoria.current !== activeParams.categoria;
    prevSubcategoria.current = activeParams.subcategoria;
    prevCategoria.current = activeParams.categoria;

    if ((subChanged || catChanged) && searchValue) {
      setSearchValue("");
      setDropdownResults([]);
      setDropdownOpen(false);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("q");
      params.delete("busqueda");
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [activeParams.subcategoria, activeParams.categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Debounce: auto-search after 3 chars, 400ms delay
  useEffect(() => {
    if (searchValue.length === 0) {
      updateParam("q", null);
      setDropdownResults([]);
      setDropdownOpen(false);
      return;
    }
    if (searchValue.length < 3) {
      setDropdownResults([]);
      setDropdownOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      updateParam("q", searchValue);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dropdown inline results
  useEffect(() => {
    if (searchValue.length < 3) return;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchProductsInline(searchValue);
      setDropdownResults(results);
      setDropdownOpen(results.length > 0);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, activeParams.categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.length >= 3 || searchValue.length === 0) {
      updateParam("q", searchValue || null);
    }
  };

  const hasActiveFilters = Object.entries(activeParams).some(([key, value]) => {
    if (key === 'seccion') return false;
    return Boolean(value);
  });

  return (
    <div className="w-full space-y-4 mb-10">
      {/* Contenedor Único de Filtros y Búsqueda */}
      <div className="flex flex-col lg:flex-row gap-4 bg-luxury-black border border-luxury-gray p-4 rounded-sm shadow-2xl items-end">
        {/* Input de Búsqueda */}
        <div ref={searchContainerRef} className="relative flex-1 w-full">
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => dropdownResults.length > 0 && setDropdownOpen(true)}
              placeholder="¿Qué estás buscando?..."
              className="w-full bg-black border border-luxury-gray-mid text-white text-sm px-10 py-3 focus:outline-none focus:border-gold transition-colors rounded-sm placeholder:text-gray-400 h-[46px]"
            />
            {searching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gold animate-spin" size={14} />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            )}
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  updateParam("q", null);
                  setDropdownOpen(false);
                  setDropdownResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </form>

          {/* Dropdown de resultados inline */}
          {dropdownOpen && dropdownResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-luxury-black border border-luxury-gray shadow-2xl shadow-black/80 divide-y divide-luxury-gray/50">
              {dropdownResults.map((p) => (
                <Link
                  key={p.id}
                  href={`/productos/${p.slug}`}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gold/5 transition-colors group"
                >
                  <div className="w-10 h-10 shrink-0 bg-luxury-gray overflow-hidden">
                    {p.imagen_url ? (
                      <Image src={p.imagen_url} alt={p.nombre} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <NoImagePlaceholder width={40} height={40} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate group-hover:text-gold transition-colors">{p.nombre}</p>
                    <p className="text-luxury-gray-light text-[11px]">{p.marca}</p>
                  </div>
                  <p className="text-gold text-sm font-semibold shrink-0">{formatPrice(p.precio_venta)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Grupo de Dropdowns Custom */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="min-w-[160px] flex-1 lg:flex-none">
            <CustomSelect
              value={activeParams.ordenar || ""}
              onChange={(val) => updateParam("ordenar", val || null)}
              options={ordenOpciones}
              placeholder="ORDENAR POR"
            />
          </div>

          {/* Botón Limpiar */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchValue("");
                router.push(pathname + (activeParams.seccion ? `?seccion=${activeParams.seccion}` : ""));
              }}
              className="h-[46px] px-4 text-red-500 hover:bg-red-500/10 transition-colors rounded-sm flex items-center justify-center border border-red-500/20"
              title="Limpiar filtros"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Subcategorías de la categoría activa (desde DB) */}
      {activeParams.categoria && subcategorias.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {subcategorias.map((sub) => {
            const isActive = activeParams.subcategoria === sub.slug;
            const buildUrl = () => {
              const params = new URLSearchParams(searchParams.toString());
              if (isActive) {
                params.delete("subcategoria");
              } else {
                params.set("subcategoria", sub.slug);
              }
              return `${pathname}?${params.toString()}`;
            };
            return (
              <Link
                key={sub.id}
                href={buildUrl()}
                className={`px-4 py-2 text-[11px] uppercase tracking-widest border transition-all rounded-sm ${
                  isActive
                    ? "bg-gold border-gold text-black font-bold"
                    : "bg-luxury-gray/60 border-luxury-gray-mid text-luxury-gray-light hover:border-gold hover:text-white"
                }`}
              >
                {sub.nombre}
              </Link>
            );
          })}
        </div>
      )}

      {/* Subcategorías específicas (Bienestar/Aromatizantes/Skincare) */}
      {(activeParams.seccion === "bienestar" || 
        activeParams.seccion === "aromatizantes" || 
        activeParams.seccion === "cuidados-piel") && (
        <div className="flex flex-col gap-2 pt-2">
          {/* Fila 1: VER TODO + categorías padre */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${activeParams.seccion}`}
              className={`px-4 py-2 text-[11px] uppercase tracking-widest border transition-all rounded-sm ${
                !activeParams.categoria
                  ? "bg-gold border-gold text-black font-bold"
                  : "bg-luxury-gray/60 border-luxury-gray-mid text-luxury-gray-light hover:border-gold hover:text-white"
              }`}
            >
              VER TODO
            </Link>
            {(activeParams.seccion === "bienestar"
               ? bienestar
               : activeParams.seccion === "cuidados-piel"
                 ? skincare
                 : aromatizantes)
              .filter(item => item.nombre !== "VER TODO")
              .map((item) => {
                const parentSlug = item.href?.split("/").pop() ?? "";
                const currentCat = activeParams.categoria;
                const isParentActive =
                  currentCat === parentSlug ||
                  (item.sub?.some(s => s.href.split("/").pop() === currentCat) ?? false);

                const buildCatUrl = (slug: string) => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (currentCat === slug) {
                    params.delete("categoria");
                  } else {
                    params.set("categoria", slug);
                  }
                  return `${pathname}?${params.toString()}`;
                };

                return (
                  <Link
                    key={item.nombre}
                    href={buildCatUrl(parentSlug)}
                    className={`px-4 py-2 text-[11px] uppercase tracking-widest border transition-all rounded-sm ${
                      isParentActive
                        ? "bg-gold border-gold text-black font-bold"
                        : "bg-luxury-gray/60 border-luxury-gray-mid text-luxury-gray-light hover:border-gold hover:text-white"
                    }`}
                  >
                    {item.nombre}
                  </Link>
                );
              })}
          </div>

          {/* Fila 2: subcategorías del padre activo */}
          {(() => {
            const navItems = activeParams.seccion === "bienestar"
              ? bienestar
              : activeParams.seccion === "cuidados-piel"
                ? skincare
                : aromatizantes;
            const currentCat = activeParams.categoria;
            const activeParent = navItems.find(item => {
              const parentSlug = item.href?.split("/").pop() ?? "";
              return (
                currentCat === parentSlug ||
                (item.sub?.some(s => s.href.split("/").pop() === currentCat) ?? false)
              );
            });

            if (!activeParent?.sub) return null;

            const buildCatUrl = (slug: string) => {
              const params = new URLSearchParams(searchParams.toString());
              if (currentCat === slug) {
                params.delete("categoria");
              } else {
                params.set("categoria", slug);
              }
              return `${pathname}?${params.toString()}`;
            };

            return (
              <div className="flex flex-wrap gap-2 pl-2 border-l border-gold/30">
                {activeParent.sub.map(s => {
                  const subSlug = s.href.split("/").pop() ?? "";
                  return (
                    <Link
                      key={s.nombre}
                      href={buildCatUrl(subSlug)}
                      className={`px-4 py-2 text-[11px] uppercase tracking-widest border transition-all rounded-sm ${
                        currentCat === subSlug
                          ? "bg-gold border-gold text-black font-bold"
                          : "bg-luxury-gray/60 border-luxury-gray-mid text-luxury-gray-light hover:border-gold hover:text-white"
                      }`}
                    >
                      {s.nombre}
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
