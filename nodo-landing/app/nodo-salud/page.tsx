"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Stethoscope, Shield, Heart, Check, ArrowRight } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { getNodeBySlug } from "@/lib/nodes";
import { CLINICA_ACCENT, getNodoLogoSrc } from "@/lib/node-accents";

const saludLogoSrc = getNodoLogoSrc("salud");

const CLINICA_FEATURES = [
  "Agenda online y turnos programados",
  "Videoconsultas con Jitsi Meet, sin instalaciones",
  "Historias clínicas digitalizadas",
  "Resúmenes SOAP automáticos con IA",
  "Recetas y pedidos de estudios con firma digital",
  "Interconsulta interdisciplinaria entre especialistas",
  "Entorno privado, seguro y estandarizado",
];

function IntroWithLogo({ text }: { text: string }) {
  const parts = text.split(/\bNODO\b/g);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={saludLogoSrc}
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
              <Icon className="h-9 w-9" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-[13px] font-bold uppercase tracking-[.16em] text-teal-400 mb-4">
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={saludLogoSrc}
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
                href="/nodo-clinica/login"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${CLINICA_ACCENT.brand}, ${CLINICA_ACCENT.brand600})`,
                  boxShadow: `0 8px 24px -8px rgba(${CLINICA_ACCENT.rgb},.45)`,
                }}
              >
                Entrar al módulo
              </Link>
              <a
                href="#precios"
                className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
              >
                Ver precios
              </a>
            </div>
          </div>
        </section>

        {/* Intro Copy */}
        {intro && (
          <section
            className="pt-[clamp(24px,4vw,40px)] pb-[clamp(24px,3vw,40px)]"
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

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <section
          id="precios"
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(48px,6vw,80px)]"
          style={{
            backgroundColor: "var(--color-navy-900)",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p
                className="text-[13px] font-bold uppercase tracking-[.16em] mb-3"
                style={{ color: CLINICA_ACCENT.brand }}
              >
                Planes
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Empezá con NODO | Clínica
              </h2>
              <p
                className="mt-4 max-w-md mx-auto"
                style={{ fontSize: 15, color: "rgba(234,240,247,.6)" }}
              >
                Probá gratis 7 días con toda la funcionalidad habilitada.
                Después, seguí con el plan Pro sin perder nada de lo cargado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Demo */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: `1px solid rgba(${CLINICA_ACCENT.rgb},.25)`,
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(${CLINICA_ACCENT.rgb},.15), transparent 70%)`,
                  }}
                />

                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: CLINICA_ACCENT.brand }}
                >
                  Demo
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Ideal para probar el consultorio virtual sin compromiso
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    Gratis
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / 7 días
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Toda la funcionalidad habilitada, sin tarjeta.
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {CLINICA_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: `rgba(${CLINICA_ACCENT.rgb},.2)`,
                          color: CLINICA_ACCENT.brand300,
                        }}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-clinica/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: "rgba(255,255,255,.06)",
                    border: `1px solid rgba(${CLINICA_ACCENT.rgb},.4)`,
                  }}
                >
                  Empezar demo de 7 días <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Pro */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #1a1a2e, #16213e)",
                  border: `2px solid rgba(${CLINICA_ACCENT.rgb},.5)`,
                  boxShadow: `0 20px 60px -20px rgba(${CLINICA_ACCENT.rgb},.3), 0 0 0 1px rgba(${CLINICA_ACCENT.rgb},.1)`,
                }}
              >
                {/* Badge */}
                <div className="absolute top-5 right-5">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: CLINICA_ACCENT.brand }}
                  >
                    Recomendado
                  </span>
                </div>

                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: CLINICA_ACCENT.brand }}
                >
                  Pro
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Consultorio virtual completo, sin límite de tiempo
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    USD 150
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Los primeros 7 días son gratis, igual que en Demo.
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {CLINICA_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: `rgba(${CLINICA_ACCENT.rgb},.2)`,
                          color: CLINICA_ACCENT.brand300,
                        }}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-clinica/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: `linear-gradient(135deg, ${CLINICA_ACCENT.brand}, ${CLINICA_ACCENT.brand600})`,
                    boxShadow: `0 6px 20px -6px rgba(${CLINICA_ACCENT.rgb},.45)`,
                  }}
                >
                  Empezar con Nodo Clínica <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights / Enfoque */}
        {highlights && highlights.length > 0 && (
          <section
            className="pt-[clamp(32px,4vw,48px)] pb-[clamp(64px,8vw,96px)]"
            style={{
              backgroundColor: "var(--color-navy)",
              borderTop: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div className="w-[min(1200px,92vw)] mx-auto">
              <div className="text-center mb-12">
                <p
                  className="text-[13px] font-bold uppercase tracking-[.16em] mb-3"
                  style={{ color: CLINICA_ACCENT.brand }}
                >
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
                    <h3
                      className="font-display font-bold text-[17px] mb-3"
                      style={{ color: CLINICA_ACCENT.brand }}
                    >
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
