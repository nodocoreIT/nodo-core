"use client";

import { useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

interface Page {
  src: string;
  alt: string;
}

interface Props {
  pages: Page[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlipBookRef = any;

export default function FlipBook({ pages }: Props) {
  const bookRef = useRef<FlipBookRef>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const totalPages = pages.length;

  const goNext = () => bookRef.current?.pageFlip().flipNext();
  const goPrev = () => bookRef.current?.pageFlip().flipPrev();

  const toggleFullscreen = () => {
    const el = document.getElementById("flipbook-wrapper");
    if (!document.fullscreenElement) {
      el?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const width = isFullscreen ? 520 : 450;
  const height = isFullscreen ? 740 : 635;

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      <div
        id="flipbook-wrapper"
        className="relative flex items-center justify-center bg-black cursor-pointer"
      >
        <button
          onClick={goPrev}
          disabled={currentPage === 0}
          className="absolute left-0 -translate-x-full z-10 p-3 text-gold hover:text-white disabled:text-gray-700 transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft size={32} />
        </button>

        <HTMLFlipBook
          ref={bookRef}
          width={width}
          height={height}
          size="fixed"
          minWidth={200}
          maxWidth={600}
          minHeight={300}
          maxHeight={900}
          showCover
          mobileScrollSupport={false}
          onFlip={(e: { data: number }) => setCurrentPage(e.data)}
          className="shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
          style={{}}
          startPage={0}
          drawShadow
          flippingTime={700}
          usePortrait={false}
          startZIndex={0}
          autoSize={false}
          clickEventForward
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={false}
          maxShadowOpacity={0.5}
        >
          {pages.map((page, i) => (
            <div key={i} className="w-full h-full" style={{ background: "white" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.src}
                alt={page.alt}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          ))}
        </HTMLFlipBook>

        <button
          onClick={goNext}
          disabled={currentPage >= totalPages - 1}
          className="absolute right-0 translate-x-full z-10 p-3 text-gold hover:text-white disabled:text-gray-700 transition-colors"
          aria-label="Página siguiente"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-gray-500 text-xs tracking-widest uppercase">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={toggleFullscreen}
          className="text-gray-500 hover:text-gold transition-colors"
          aria-label="Pantalla completa"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
