"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import NoImagePlaceholder from "@/components/ui/NoImagePlaceholder";
import { Search, X, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/price-utils";
import { useDolar } from "@/context/DolarContext";
import type { Producto } from "@/types";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function searchProducts(query: string): Promise<Producto[]> {
  if (query.length < 2) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, marca, slug, precio_venta, imagen_url, destacado")
    .eq("activo", true)
    .or(`nombre.ilike.%${query}%,marca.ilike.%${query}%,descripcion.ilike.%${query}%`)
    .order("destacado", { ascending: false })
    .limit(MAX_RESULTS);
  return (data as Producto[]) || [];
}

export default function QuickSearchModal() {
  const { rate: dolarRate } = useDolar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Producto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const data = await searchProducts(debouncedQuery.trim());
      setResults(data);
      setSelectedIndex(0);
    });
  }, [debouncedQuery]);

  // Ctrl+K global listener + custom event from header button
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("quick-search:open", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("quick-search:open", handleOpenEvent);
    };
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation inside modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const product = results[selectedIndex];
        if (product) {
          router.push(`/productos/${product.slug}`);
          setOpen(false);
        }
      }
    },
    [results, selectedIndex, router]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-[#111111] border border-luxury-gray-mid rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-4 border-b border-luxury-gray-mid">
          {isPending ? (
            <Loader2 className="w-5 h-5 text-gold shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gold shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar productos, marcas..."
            className="flex-1 bg-transparent text-white placeholder-[#555555] text-base outline-none"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[#555555] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-[#555555] border border-luxury-gray-mid rounded">
              ESC
            </kbd>
          </div>
        </form>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-luxury-gray">
            {results.map((product, index) => (
              <li key={product.id}>
                <button
                  className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-luxury-gray"
                      : "hover:bg-luxury-gray"
                  }`}
                  onClick={() => {
                    router.push(`/productos/${product.slug}`);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 shrink-0 bg-[#0A0A0A] rounded-md overflow-hidden border border-luxury-gray-mid">
                    {product.imagen_url ? (
                      <Image
                        src={product.imagen_url}
                        alt={product.nombre}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <NoImagePlaceholder width={48} height={48} className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{product.nombre}</p>
                    <p className="text-luxury-gray-light text-xs truncate">{product.marca}</p>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    {dolarRate ? (
                      <>
                        <p className="text-gold text-sm font-bold">
                          {formatPrice(Math.round(product.precio_venta * dolarRate))}
                        </p>
                        <p className="text-zinc-400 text-xs font-bold">
                          US$ {product.precio_venta.toLocaleString('es-AR')}
                        </p>
                      </>
                    ) : (
                      <p className="text-gold text-sm font-bold">
                        {formatPrice(product.precio_venta)}
                      </p>
                    )}
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[#444] shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query.length >= 2 && results.length === 0 && !isPending && (
          <div className="px-4 py-8 text-center text-[#555555] text-sm">
            No se encontraron productos para{" "}
            <span className="text-white">&ldquo;{query}&rdquo;</span>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-luxury-gray bg-[#0A0A0A]">
          <div className="flex items-center gap-3 text-[10px] text-[#444] font-mono">
            <span><kbd className="border border-luxury-gray-mid rounded px-1 py-0.5">↑↓</kbd> navegar</span>
            <span><kbd className="border border-luxury-gray-mid rounded px-1 py-0.5">↵</kbd> abrir</span>
            <span><kbd className="border border-luxury-gray-mid rounded px-1 py-0.5">ESC</kbd> cerrar</span>
          </div>
          {query.trim() && (
            <button
              onClick={handleSubmit}
              className="text-[10px] text-gold hover:text-white transition-colors tracking-wider uppercase font-bold"
            >
              Ver todos los resultados →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
