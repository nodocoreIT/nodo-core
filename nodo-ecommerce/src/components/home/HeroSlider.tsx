"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  imagen_url: string;
  titulo?: string | null;
  subtitulo?: string | null;
  href?: string | null;
}

const DEFAULT_SLIDES: Slide[] = [
  { imagen_url: "/slide/1.jpeg", titulo: null, subtitulo: null, href: null },
  { imagen_url: "/slide/2.jpeg", titulo: null, subtitulo: null, href: null },
];

interface Props {
  initialSlides?: Slide[];
}

export default function HeroSlider({ initialSlides }: Props) {
  const [slides] = useState<Slide[]>(initialSlides ?? DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = slides.length;

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isHovered || total <= 1) return;
    intervalRef.current = setInterval(next, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [next, isHovered, total]);


  const content = (
    <section
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: "3/1" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slide images — no overlay, fill container */}
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.imagen_url}
            alt={s.titulo ?? `Slide ${i + 1}`}
            fill
            className="object-contain"
            priority={i === 0}
            sizes="100vw"
          />
        </div>
      ))}



      {/* Prev / Next arrows — only show when more than 1 slide */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Slide anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 text-gold hover:text-white transition-colors"
          >
            <ChevronLeft size={28} strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            aria-label="Slide siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 text-gold hover:text-white transition-colors"
          >
            <ChevronRight size={28} strokeWidth={1.5} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-gold w-6"
                    : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );

  // If the current slide has a link, wrap the image layer only (not the whole section)
  return content;
}
