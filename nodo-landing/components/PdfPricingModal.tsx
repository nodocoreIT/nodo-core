"use client";

import { useRef, useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getNodeBySlug } from "@/lib/nodes";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  slug: string;
  onClose: () => void;
}

export default function PdfPricingModal({ slug, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(860);
  const [pdfExists, setPdfExists] = useState<boolean | null>(null);

  const node = getNodeBySlug(slug);
  const nodeLabel = node ? `${node.label} — Precios` : "Precios";
  const pdfUrl = `/precios/${slug}.pdf`;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setPageWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Probe for the PDF before rendering react-pdf
  useEffect(() => {
    fetch(pdfUrl, { method: "HEAD" })
      .then((r) => setPdfExists(r.ok))
      .catch(() => setPdfExists(false));
  }, [pdfUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        backgroundColor: "rgba(5,14,28,0.65)",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: "min(920px, 95vw)",
          maxHeight: "92vh",
          background: "var(--color-navy-900)",
          border: "1px solid rgba(255,255,255,.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
        >
          <span className="text-[14px] font-semibold text-white/60">
            {nodeLabel}
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors text-[16px]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" ref={containerRef}>
          {pdfExists === null && (
            <div className="flex items-center justify-center h-64 text-white/40 text-sm">
              Cargando...
            </div>
          )}

          {pdfExists === true && (
            <Document
              file={pdfUrl}
              loading={
                <div className="flex items-center justify-center h-64 text-white/40 text-sm">
                  Cargando...
                </div>
              }
            >
              <Page
                pageNumber={1}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </Document>
          )}

          {pdfExists === false && (
            <div className="flex flex-col items-center justify-center gap-5 py-20 px-6 text-center">
              <p
                className="text-white/70 max-w-[380px]"
                style={{ fontSize: 16, lineHeight: 1.6 }}
              >
                La lista de precios para {node?.label ?? "este nodo"} estará
                disponible próximamente.
              </p>
              <a
                href="mailto:info@nodocore.com.ar?subject=Solicitar presupuesto"
                className="inline-flex items-center justify-center px-6 py-3 text-[15px] font-semibold rounded-md bg-brand text-white hover:bg-brand-600 transition-colors"
              >
                Solicitar presupuesto
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
