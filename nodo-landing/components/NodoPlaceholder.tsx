"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { getNodeBySlug } from "@/lib/nodes";

const PdfPricingModal = dynamic(() => import("@/components/PdfPricingModal"), {
  ssr: false,
});

function IntroWithLogo({ text }: { text: string }) {
  const parts = text.split(/\bNODO\b/g);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logos/nodo%20nar.png"
              alt="NODO"
              style={{
                height: "0.82em",
                width: "auto",
                display: "inline-block",
                verticalAlign: "-0.04em",
                margin: "0 2px",
              }}
            />
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

export default function NodoPlaceholder({ slug }: { slug: string }) {
  const node = getNodeBySlug(slug);
  if (!node) notFound();

  const [pdfOpen, setPdfOpen] = useState(false);

  const { Icon, code, description, intro, highlights } = node;

  return (
    <div style={{ backgroundColor: "var(--color-navy-900)" }}>
      <Navbar />
      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden pt-[160px] pb-[clamp(56px,8vw,96px)]"
          style={{ backgroundColor: "var(--color-navy-900)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 38%, rgba(218,90,14,.18), transparent 70%)",
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/15 text-brand">
              <Icon className="h-9 w-9" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-[13px] font-bold uppercase tracking-[.16em] text-brand mb-4">
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/nodo%20nar.png"
                alt="Nodo"
                style={{
                  height: "0.78em",
                  width: "auto",
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#fff", fontWeight: 400 }}>|</span>
              {code}
            </h1>

            <p
              className="max-w-[560px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              {description}
            </p>

            {!intro && (
              <p className="mt-4 text-[14px] text-white/45">
                Esta sección está en construcción.
              </p>
            )}

            <div className="mt-10 flex flex-col items-center gap-4">
              {slug === "inmo" ? (
                <Link
                  href="/nodo-inmo/login"
                  className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150 shadow-md shadow-brand/15"
                >
                  Entrar a Inmo
                </Link>
              ) : (
                <>
                  {/* Row 1 */}
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="https://nodoinmo.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
                    >
                      Ver Demo
                    </Link>
                    <Link
                      href="/"
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
                    >
                      Volver al inicio
                    </Link>
                  </div>

                  {/* Row 2 */}
                  <button
                    onClick={() => setPdfOpen(true)}
                    className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
                  >
                    Ver Precios
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Content */}
        {intro && (
          <section
            className="py-[clamp(48px,7vw,96px)]"
            style={{
              backgroundColor: "var(--color-navy)",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="w-[min(1200px,92vw)] mx-auto">
              <p
                className="max-w-[720px] mx-auto leading-relaxed text-center"
                style={{
                  fontSize: "clamp(16px,1.4vw,19px)",
                  color: "rgba(234,240,247,.78)",
                }}
              >
                <IntroWithLogo text={intro} />
              </p>

              {highlights && highlights.length > 0 && (
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
                  {highlights.map((h) => (
                    <div
                      key={h.title}
                      className="rounded-xl p-6"
                      style={{
                        background: "var(--color-navy-700)",
                        border: "1px solid rgba(255,255,255,.1)",
                      }}
                    >
                      <h3
                        className="font-display font-bold text-brand-300"
                        style={{ fontSize: 17, marginBottom: 8 }}
                      >
                        {h.title}
                      </h3>
                      <p
                        className="leading-relaxed"
                        style={{
                          fontSize: 14.5,
                          color: "rgba(234,240,247,.7)",
                        }}
                      >
                        {h.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />

      {pdfOpen && <PdfPricingModal onClose={() => setPdfOpen(false)} />}
    </div>
  );
}
