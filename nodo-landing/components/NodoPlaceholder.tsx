"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { Car, ArrowRight, ShoppingBag, Coins } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { getNodeBySlug } from "@/lib/nodes";
import { AUTOS_ACCENT, CLINICA_ACCENT, getNodoLogoSrc } from "@/lib/node-accents";

const PdfPricingModal = dynamic(() => import("@/components/PdfPricingModal"), {
  ssr: false,
});

function IntroWithLogo({ text, logoSrc }: { text: string; logoSrc: string }) {
  const parts = text.split(/\bNODO\b/g);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
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
  const [devOpen, setDevOpen] = useState(false);

  const { Icon, code, description, intro, highlights, inDevelopment } = node;
  const isAutos = slug === "autos";
  const isClinica = slug === "clinica";
  const nodoLogoSrc = getNodoLogoSrc(slug);

  return (
    <div style={{ backgroundColor: "var(--color-navy-900)" }}>
      <Navbar />
      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden pt-[clamp(90px,7vw,120px)] pb-[clamp(32px,5vw,56px)]"
          style={{ backgroundColor: "var(--color-navy-900)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: isAutos
                ? `radial-gradient(60% 55% at 50% 38%, rgba(${AUTOS_ACCENT.rgb},.18), transparent 70%)`
                : isClinica
                  ? `radial-gradient(60% 55% at 50% 38%, rgba(${CLINICA_ACCENT.rgb},.18), transparent 70%)`
                  : "radial-gradient(60% 55% at 50% 38%, rgba(218,90,14,.18), transparent 70%)",
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span
              className={
                isAutos
                  ? "mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-600/15 text-rose-500"
                  : isClinica
                    ? "mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-600/15 text-teal-400"
                    : "mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/15 text-brand"
              }
            >
              <Icon className="h-9 w-9" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p
              className={
                isAutos
                  ? "text-[13px] font-bold uppercase tracking-[.16em] text-rose-500 mb-4"
                  : isClinica
                    ? "text-[13px] font-bold uppercase tracking-[.16em] text-teal-400 mb-4"
                    : "text-[13px] font-bold uppercase tracking-[.16em] text-brand mb-4"
              }
            >
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nodoLogoSrc}
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

            {slug !== "it" && (
              <div className="mt-10 flex flex-col items-center gap-4">
                {slug === "inmo" ? (
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/nodo-inmo/login"
                      className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150 shadow-md shadow-brand/15"
                    >
                      Entrar a Inmo
                    </Link>
                    <button
                      onClick={() => setPdfOpen(true)}
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white cursor-pointer"
                    >
                      Ver Precios
                    </button>
                  </div>
                ) : slug === "autos" ? (
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/nodo-autos/login"
                      className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${AUTOS_ACCENT.brand}, ${AUTOS_ACCENT.brand600})`,
                        boxShadow: `0 8px 24px -8px rgba(${AUTOS_ACCENT.rgb},.45)`,
                      }}
                    >
                      Entrar al Concesionario
                    </Link>
                    <button
                      onClick={() => setPdfOpen(true)}
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white cursor-pointer"
                    >
                      Ver Precios
                    </button>
                  </div>
                ) : slug === "finanzas" ? (
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/nodo-finanzas/login"
                      className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[.98] transition-all duration-150 shadow-md shadow-emerald-600/15"
                    >
                      Entrar al módulo
                    </Link>
                    <button
                      onClick={() => setPdfOpen(true)}
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white cursor-pointer"
                    >
                      Ver Precios
                    </button>
                  </div>
                ) : slug === "clinica" ? (
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/nodo-clinica/login"
                      className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${CLINICA_ACCENT.brand}, ${CLINICA_ACCENT.brand600})`,
                        boxShadow: `0 8px 24px -8px rgba(${CLINICA_ACCENT.rgb},.45)`,
                      }}
                    >
                      Entrar a Clínica
                    </Link>
                    <button
                      onClick={() => setPdfOpen(true)}
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white cursor-pointer"
                    >
                      Ver Precios
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {inDevelopment ? (
                      <button
                        onClick={() => setDevOpen(true)}
                        className="btn-ghost-light inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[16px] font-semibold rounded-md text-white/70 cursor-pointer"
                      >
                        <span aria-hidden>🚧</span>
                        En construcción
                      </button>
                    ) : (
                      <Link
                        href="https://nodoinmo.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
                      >
                        Ver Demo
                      </Link>
                    )}
                    <button
                      onClick={() => setPdfOpen(true)}
                      className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
                    >
                      Ver Precios
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Content */}
        {intro && (
          <section
            className="pt-[clamp(24px,4vw,48px)] pb-[clamp(48px,7vw,96px)]"
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
                <IntroWithLogo text={intro} logoSrc={nodoLogoSrc} />
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

        {/* Submodules Section for IT */}
        {slug === "it" && (
          <section
            id="submodulos"
            className="pt-[clamp(32px,4vw,56px)] pb-[clamp(64px,8vw,112px)] relative"
            style={{
              backgroundColor: "var(--color-navy-900)",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="w-[min(1200px,92vw)] mx-auto">
              <div className="text-center mb-12">
                <p className="text-[13px] font-bold uppercase tracking-[.16em] text-brand mb-3">
                  Arquitectura Modular
                </p>
                <h2 className="font-display font-extrabold text-white text-[clamp(28px,3vw,42px)]">
                  Submódulos de NODO | IT
                </h2>
                <p className="text-slate2-300 max-w-xl mx-auto mt-4 text-[15px]">
                  Desglosamos la infraestructura y software a medida en soluciones tecnológicas específicas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {/* Active Submodule: Nodo Autos */}
                <div
                  className="rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-navy-700), var(--color-navy))",
                    border: `1px solid rgba(${AUTOS_ACCENT.rgb}, 0.25)`,
                    boxShadow: `0 10px 30px -15px rgba(${AUTOS_ACCENT.rgb}, 0.15)`,
                  }}
                >
                  <div>
                    <div className="h-12 w-12 rounded-xl bg-rose-600/15 text-rose-500 flex items-center justify-center mb-6">
                      <Car className="h-6 w-6" />
                    </div>
                    <h3 className="font-display font-bold text-white text-[20px] mb-3">
                      Nodo Autos
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                      Disponible
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-slate2-300 mb-6">
                      Panel de gestión de stock para concesionarias y agencias de autos: inventario, clientes, publicaciones y contratos de venta.
                    </p>
                  </div>
                  <Link
                    href="/nodo-autos"
                    className="inline-flex items-center gap-2 text-rose-500 font-semibold text-[15px] hover:text-rose-400 transition-colors"
                  >
                    Ver Módulo <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Submodule: Nodo Finanzas */}
                <div
                  className="rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-navy-700), var(--color-navy))",
                    border: "1px solid rgba(5, 150, 105, 0.25)",
                    boxShadow: "0 10px 30px -15px rgba(5, 150, 105, 0.15)",
                  }}
                >
                  <div>
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-6">
                      <Coins className="h-6 w-6" />
                    </div>
                    <h3 className="font-display font-bold text-white text-[20px] mb-3">
                      Nodo Finanzas
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                      Disponible
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-slate2-300 mb-6">
                      Control de finanzas personales: gastos, tarjetas de crédito, préstamos, planes de ahorro e informe mensual.
                    </p>
                  </div>
                  <Link
                    href="/nodo-finanzas"
                    className="inline-flex items-center gap-2 text-emerald-400 font-semibold text-[15px] hover:text-emerald-300 transition-colors"
                  >
                    Ver Módulo <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Submodule: Nodo Ecommerce */}
                <div
                  className="rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-navy-700), var(--color-navy))",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    boxShadow: "0 10px 30px -15px rgba(245, 158, 11, 0.15)",
                  }}
                >
                  <div>
                    <div className="h-12 w-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-6">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <h3 className="font-display font-bold text-white text-[20px] mb-3">
                      Nodo Ecommerce
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                      Disponible
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-slate2-300 mb-6">
                      Todo para gestionar tu e-commerce de manera profesional: catálogo de productos, pasarelas de pago, envíos integrados y control de ventas.
                    </p>
                  </div>
                  <Link
                    href="/nodo-ecommerce"
                    className="inline-flex items-center gap-2 text-amber-400 font-semibold text-[15px] hover:text-amber-300 transition-colors"
                  >
                    Ver Módulo <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />

      {pdfOpen && <PdfPricingModal slug={slug} onClose={() => setPdfOpen(false)} />}

      {devOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            backgroundColor: "rgba(5,14,28,0.65)",
          }}
          onClick={() => setDevOpen(false)}
        >
          <div
            className="flex flex-col items-center text-center gap-5 rounded-2xl px-10 py-12 shadow-2xl max-w-md w-full"
            style={{
              background: "var(--color-navy-900)",
              border: "1px solid rgba(255,255,255,.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl" aria-hidden>🚧</span>
            <h2 className="font-display font-bold text-white text-xl">
              En desarrollo
            </h2>
            <p className="text-white/65 leading-relaxed text-[15px]">
              Estamos construyendo el sistema de gestión para{" "}
              <span className="text-white font-semibold">{node!.label}</span>.
              Próximamente vas a poder acceder desde acá.
            </p>
            <button
              onClick={() => setDevOpen(false)}
              className="mt-2 inline-flex items-center justify-center px-6 py-2.5 text-[14px] font-semibold rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
