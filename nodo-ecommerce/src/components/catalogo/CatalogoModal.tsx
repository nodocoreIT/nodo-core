"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCatalogo } from "@/context/CatalogoContext";

const FlipBook = dynamic(() => import("./FlipBook"), { ssr: false });

const CATALOG_PAGES = [
  { src: "/catalogo/portada.png", alt: "Portada — Mi Tienda" },
  { src: "/catalogo/pagina-02.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-03.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-04.png", alt: "Femeninas Femeninas" },
  { src: "/catalogo/pagina-05.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-06.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-07.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-08.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-09.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-10.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-11.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-12.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-13.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-14.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-15.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-16.png", alt: "Fragancias Femeninas" },
  { src: "/catalogo/pagina-17.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-18.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-19.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-20.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-21.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-22.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-23.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-24.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-25.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-26.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-27.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-28.png", alt: "Fragancias Masculinas" },
  { src: "/catalogo/pagina-29.png", alt: "Fragancias Árabes" },
  { src: "/catalogo/pagina-30.png", alt: "Fragancias Árabes" },
  { src: "/catalogo/pagina-31.png", alt: "Fragancias Árabes" },
  { src: "/catalogo/pagina-32.png", alt: "Eau de Toilette" },
  { src: "/catalogo/pagina-33.png", alt: "Eau de Toilette" },
  { src: "/catalogo/pagina-34.png", alt: "Eau de Toilette" },
];

export default function CatalogoModal() {
  const { isOpen, close } = useCatalogo();

  // Cerrar con ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop con blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
      />

      {/* Panel del catálogo */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-12 py-8 w-full">
        {/* Header del modal */}
        <div className="flex items-center justify-between w-full max-w-3xl">
          <div>
            <p className="text-gold text-[10px] tracking-[0.5em] uppercase">
              Mi Tienda
            </p>
            <h2 className="font-serif text-2xl text-white mt-1">
              Catálogo Digital
            </h2>
          </div>
          <button
            onClick={close}
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label="Cerrar catálogo"
          >
            <X size={24} />
          </button>
        </div>

        {/* Flip Book */}
        <FlipBook pages={CATALOG_PAGES} />

        <p className="text-gray-700 text-xs tracking-wider">
          Hacé clic en los bordes de la página o usá las flechas para navegar · ESC para cerrar
        </p>
      </div>
    </div>
  );
}
