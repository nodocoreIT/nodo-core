"use client";

import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { CLINICA_ACCENT, getNodoLogoSrc } from "@/lib/node-accents";

const clinicaLogoSrc = getNodoLogoSrc("clinica");

export default function Page() {
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
              background: `radial-gradient(60% 55% at 50% 38%, rgba(${CLINICA_ACCENT.rgb},.18), transparent 70%)`,
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-600/15 text-teal-400">
              <Stethoscope className="h-9 w-9" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-[13px] font-bold uppercase tracking-[.16em] text-teal-400 mb-4">
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/estrella%20bco%20nar.png" alt="" aria-hidden style={{ height: "0.78em", width: "auto", display: "inline-block" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clinicaLogoSrc} alt="Nodo" style={{ height: "0.78em", width: "auto", display: "inline-block" }} />
              <span style={{ color: "#fff", fontWeight: 400 }}>|</span>
              Clínica
            </h1>

            <p
              className="max-w-[560px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              Plataforma HealthTech para telemedicina profesional: consultorios virtuales,
              recetas digitales e informes automatizados con IA.
            </p>

            <div className="mt-10">
              <Link
                href="https://clinica.nodocore.com.ar/login"
                className="inline-flex items-center justify-center px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${CLINICA_ACCENT.brand}, ${CLINICA_ACCENT.brand600})`,
                  boxShadow: `0 8px 24px -8px rgba(${CLINICA_ACCENT.rgb},.45)`,
                }}
              >
                Entrar al módulo   <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Intro */}
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
              Digitalizá tu consultorio: agenda online, videoconsultas, prescripciones
              digitales y resúmenes SOAP generados con IA.
            </p>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: "Videoconsultas",
                  description: "Consultorios virtuales con Jitsi Meet, sin instalaciones.",
                },
                {
                  title: "IA Clínica",
                  description:
                    "Resúmenes SOAP automáticos desde la transcripción de la consulta.",
                },
                {
                  title: "Recetas digitales",
                  description:
                    "Emití prescripciones y pedidos de estudios con firma digital en PDF.",
                },
              ].map((h) => (
                <div
                  key={h.title}
                  className="rounded-xl p-6"
                  style={{
                    background: "var(--color-navy-700)",
                    border: "1px solid rgba(255,255,255,.1)",
                  }}
                >
                  <h3
                    className="font-display font-bold text-teal-300"
                    style={{ fontSize: 17, marginBottom: 8 }}
                  >
                    {h.title}
                  </h3>
                  <p
                    className="leading-relaxed"
                    style={{ fontSize: 14.5, color: "rgba(234,240,247,.7)" }}
                  >
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Submódulos */}
        <section
          className="py-[clamp(48px,7vw,96px)]"
          style={{
            backgroundColor: "var(--color-navy-900)",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <p className="text-center text-[13px] font-bold uppercase tracking-[.16em] text-teal-400 mb-3">
              Módulos en desarrollo
            </p>

            <div className="max-w-[400px] mx-auto">
              {/* Proveedores de Salud — PRÓXIMAMENTE */}
              <div
                className="rounded-2xl p-7 flex flex-col gap-4"
                style={{
                  background: "var(--color-navy-700)",
                  border: "1px solid rgba(255,255,255,.06)",
                  opacity: 0.72,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0"
                    style={{ background: "rgba(255,255,255,.06)" }}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="rgba(234,240,247,.45)"
                      strokeWidth={1.75}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <span
                    className="mt-0.5 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                    style={{ background: "rgba(255,255,255,.08)", color: "rgba(234,240,247,.5)" }}
                  >
                    Próximamente
                  </span>
                </div>
                <div>
                  <h3
                    className="font-display font-bold text-white mb-1"
                    style={{ fontSize: 18 }}
                  >
                    Proveedores de Salud
                  </h3>
                  <p style={{ fontSize: 14, color: "rgba(234,240,247,.5)", lineHeight: 1.6 }}>
                    Gestión integral para clínicas, sanatorios y prestadores: facturación a
                    obras sociales, turnos y expedientes.
                  </p>
                </div>
                <span className="mt-auto text-[13px] font-semibold" style={{ color: "rgba(234,240,247,.3)" }}>
                  En desarrollo
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
