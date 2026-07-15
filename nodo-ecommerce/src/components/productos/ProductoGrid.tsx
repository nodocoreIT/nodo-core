"use client";

import { useState } from "react";
import { Producto } from "@/types";
import ProductoCard from "./ProductoCard";
import { LayoutGrid, Grid3X3, Grid2X2 } from "lucide-react";

interface Props {
  productos: Producto[];
  emptyMessage?: string;
  dolarEnabled?: boolean;
  showViewToggle?: boolean;
}

type ViewMode = "large" | "standard" | "compact";

const PAGE_SIZE = 24;

export default function ProductoGrid({
  productos,
  emptyMessage = "No se encontraron productos.",
  dolarEnabled = false,
  showViewToggle = true,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (productos.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4 text-luxury-gray-mid">✦</div>
        <p className="text-luxury-gray-light">{emptyMessage}</p>
      </div>
    );
  }

  const getGridClasses = () => {
    switch (viewMode) {
      case "large":
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";
      case "compact":
        return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3";
      case "standard":
      default:
        return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* View Toggle Bar */}
      {showViewToggle && <div className="flex justify-end items-center border-b border-luxury-gray pb-4 mb-2">
        <div className="flex items-center bg-luxury-black p-1 rounded-lg border border-luxury-gray">
          <button
            onClick={() => setViewMode("large")}
            className={`p-2 rounded-md transition-all ${
              viewMode === "large"
                ? "bg-black text-gold shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
            title="Vista Grande (3 por fila)"
          >
            <Grid2X2 size={18} />
          </button>
          <button
            onClick={() => setViewMode("standard")}
            className={`p-2 rounded-md transition-all ${
              viewMode === "standard"
                ? "bg-black text-gold shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
            title="Vista Estándar"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode("compact")}
            className={`p-2 rounded-md transition-all ${
              viewMode === "compact"
                ? "bg-black text-gold shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
            title="Vista Compacta (6 por fila)"
          >
            <Grid3X3 size={18} />
          </button>
        </div>
      </div>}

      {/* Grid */}
      <div className={`grid transition-all duration-300 ${getGridClasses()}`}>
        {productos.slice(0, visible).map((producto, i) => (
          <ProductoCard
            key={producto.id}
            producto={producto}
            isCompact={viewMode === "compact"}
            priority={i < 8}
            dolarEnabled={dolarEnabled}
          />
        ))}
      </div>

      {visible < productos.length && (
        <div className="flex flex-col items-center gap-2 pt-4">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-8 py-3 border border-gold/40 text-gold text-sm font-bold tracking-widest uppercase hover:bg-gold/10 transition-colors"
          >
            Ver más productos ({productos.length - visible} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
