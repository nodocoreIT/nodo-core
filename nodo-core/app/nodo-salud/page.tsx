"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  Shield,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Heart,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { getNodeBySlug } from "@/lib/nodes";

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

export default function Page() {
  const node = getNodeBySlug("salud");
  if (!node) return null;

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
              className="max-w-[650px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="#submodulos"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
              >
                Ver Submódulos
              </Link>
              <Link
                href="/"
                className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </section>

        {/* Intro Copy */}
        {intro && (
          <section
            className="py-[clamp(48px,5vw,72px)]"
            style={{
              backgroundColor: "var(--color-navy)",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="w-[min(1200px,92vw)] mx-auto">
              <p
                className="max-w-[800px] mx-auto leading-relaxed text-center"
                style={{
                  fontSize: "clamp(16px,1.4vw,19px)",
                  color: "rgba(234,240,247,.78)",
                }}
              >
                <IntroWithLogo text={intro} />
              </p>
            </div>
          </section>
        )}

        {/* Submodules Section */}
        <section
          id="submodulos"
          className="py-[clamp(64px,8vw,112px)] relative"
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
                Submódulos de NODO | Salud
              </h2>
              <p className="text-slate2-300 max-w-xl mx-auto mt-4 text-[15px]">
                Desglosamos la complejidad médica en herramientas digitales
                específicas y conectadas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Active Submodule: Clinica Virtual */}
              <div
                className="rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-navy-700), var(--color-navy))",
                  border: "1px solid rgba(218, 90, 14, 0.25)",
                  boxShadow: "0 10px 30px -15px rgba(218, 90, 14, 0.15)",
                }}
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center mb-6">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-white text-[20px] mb-3">
                    Clínica Virtual
                  </h3>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                    Disponible
                  </span>
                  <p className="text-[14.5px] leading-relaxed text-slate2-300 mb-6">
                    Plataforma HealthTech para telemedicina profesional. Gestión
                    de agenda, videoconsultas, historias clínicas y resúmenes
                    SOAP asistidos por Inteligencia Artificial.
                  </p>
                </div>
                <Link
                  href="/nodo-salud/clinica-virtual"
                  className="inline-flex items-center gap-2 text-brand font-semibold text-[15px] hover:text-brand-300 transition-colors"
                >
                  Acceder al módulo <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Inactive Submodule: Proveedores */}
              <div
                className="rounded-2xl p-8 flex flex-col justify-between opacity-75"
                style={{
                  background: "var(--color-navy-700)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div>
                  <div className="h-12 w-12 rounded-xl bg-white/5 text-slate2-300 flex items-center justify-center mb-6">
                    <LayoutGrid className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-white text-[20px] mb-3">
                    Proveedores de Salud
                  </h3>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/5 text-white/50 border border-white/10 mb-4">
                    Próximamente
                  </span>
                  <p className="text-[14.5px] leading-relaxed text-slate2-300/80 mb-6">
                    Ecosistema de negocios médicos: venta de prótesis, insumos
                    clínicos y equipamiento con trazabilidad de transacciones y
                    logística integrada.
                  </p>
                </div>
                <span className="text-[14px] text-white/45 font-medium">
                  En desarrollo
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights / Enfoque */}
        {highlights && highlights.length > 0 && (
          <section
            className="py-[clamp(64px,8vw,96px)]"
            style={{
              backgroundColor: "var(--color-navy)",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="w-[min(1200px,92vw)] mx-auto">
              <div className="text-center mb-12">
                <p className="text-[13px] font-bold uppercase tracking-[.16em] text-brand mb-3">
                  Nuestro Enfoque
                </p>
                <h2 className="font-display font-bold text-white text-[28px]">
                  Pilares de NODO | Salud
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {highlights.map((h) => (
                  <div
                    key={h.title}
                    className="rounded-xl p-6"
                    style={{
                      background: "var(--color-navy-700)",
                      border: "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <h3 className="font-display font-bold text-brand-300 text-[17px] mb-3">
                      {h.title}
                    </h3>
                    <p
                      className="leading-relaxed text-[14.5px]"
                      style={{
                        color: "rgba(234,240,247,.7)",
                      }}
                    >
                      {h.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
