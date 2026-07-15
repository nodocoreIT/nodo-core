"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CategoriasSidebar() {
  const searchParams = useSearchParams();

  return (
    <div className="space-y-6">
      <div className="border-b border-luxury-gray-mid pb-2 mb-6">
        <h3 className="text-gold text-[10px] font-bold tracking-[0.2em] uppercase">
          Categorías
        </h3>
      </div>

    </div>
  );
}
