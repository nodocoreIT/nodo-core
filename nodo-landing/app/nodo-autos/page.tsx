"use client";

import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import {
  Car,
  Users,
  FileText,
  Share2,
  Wallet,
  Calendar,
  Building2,
  Check,
  ArrowRight,
  Zap,
} from "lucide-react";
import { AUTOS_ACCENT, getNodoLogoSrc } from "@/lib/node-accents";
import { getNodeBySlug } from "@/lib/nodes";

const autosLogoSrc = getNodoLogoSrc("autos");
const accent = AUTOS_ACCENT;

const FEATURES = [
  {
    Icon: Car,
    title: "Stock inteligente",
    description:
      "Inventario de vehículos con fotos, filtros avanzados y estado en tiempo real.",
  },
  {
    Icon: Share2,
    title: "Publicación multicanal",
    description:
      "Publicá en Instagram, Facebook, MercadoLibre y tu sitio web desde un solo panel.",
  },
  {
    Icon: FileText,
    title: "Contratos digitales",
    description:
      "Generá contratos de compraventa en PDF con datos del comprador y condiciones de pago.",
  },
  {
    Icon: Users,
    title: "Clientes y leads",
    description:
      "Seguimiento de interesados, historial de contacto y pipeline de ventas.",
  },
  {
    Icon: Wallet,
    title: "Caja y movimientos",
    description:
      "Registrá ingresos, egresos y comisiones vinculados a cada operación.",
  },
  {
    Icon: Calendar,
    title: "Agenda y tareas",
    description:
      "Visitas, entregas y seguimientos organizados para todo el equipo.",
  },
];

const STARTER_FEATURES = [
  "Hasta 30 vehículos en stock",
  "Ficha con fotos, precio y estado",
  "Gestión básica de clientes",
  "Contratos de venta en PDF",
  "1 usuario administrador",
  "Acceso web desde cualquier dispositivo",
];

const PRO_FEATURES = [
  "Stock ilimitado de vehículos",
  "Publicación en Instagram, Facebook y MercadoLibre",
  "Link público por vehículo (QR y web)",
  "Múltiples usuarios y roles",
  "Caja, movimientos y conceptos",
  "Agenda y tareas del equipo",
  "Importación masiva CSV/Excel",
];

const ENTERPRISE_FEATURES = [
  "Todo lo de Pro, más:",
  "Multi-sucursal y equipos ampliados",
  "Automatizaciones n8n para redes",
  "Integraciones y API a medida",
  "Soporte prioritario dedicado",
  "NODO ID · conexión con el ecosistema",
  "Onboarding y capacitación incluidos",
];

const COMPARISON_ROWS = [
  { label: "Stock de vehículos con fotos y estados", starter: true, pro: true, enterprise: true },
  { label: "Clientes y seguimiento de interesados", starter: true, pro: true, enterprise: true },
  { label: "Contratos de compraventa en PDF", starter: true, pro: true, enterprise: true },
  { label: "Publicación multicanal (redes + ML)", starter: false, pro: true, enterprise: true },
  { label: "Caja, movimientos y agenda", starter: false, pro: true, enterprise: true },
  { label: "Múltiples usuarios y roles", starter: false, pro: true, enterprise: true },
  { label: "Link público / QR por vehículo", starter: false, pro: true, enterprise: true },
  { label: "Multi-sucursal", starter: false, pro: false, enterprise: true },
  { label: "Automatizaciones e integraciones API", starter: false, pro: false, enterprise: true },
  { label: "Soporte prioritario + NODO ID", starter: false, pro: false, enterprise: true },
];

function PlanCheck() {
  return (
    <span
      className="shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `rgba(${accent.rgb}, 0.2)`, color: accent.brand }}
    >
      <Check className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

export default function NodoAutosPage() {
  const node = getNodeBySlug("autos");

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
              background: `radial-gradient(60% 55% at 50% 38%, rgba(${accent.rgb},.18), transparent 70%)`,
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span
              className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `rgba(${accent.rgb}, 0.15)`,
                color: accent.brand,
              }}
            >
              <Car className="h-9 w-9" strokeWidth={1.75} />
            </span>

            <p
              className="text-[13px] font-bold uppercase tracking-[.16em] mb-4"
              style={{ color: accent.brand }}
            >
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/estrella%20bco%20nar.png" alt="" aria-hidden style={{ height: "0.78em", width: "auto", display: "inline-block" }} />
              <span style={{ color: "#fff" }}>nodo</span>
              <span style={{ color: "#fff", fontWeight: 400 }}>|</span>
              Autos
            </h1>

            <p
              className="max-w-[560px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              {node?.description}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/nodo-autos/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accent.brand}, ${accent.brand600})`,
                  boxShadow: `0 8px 24px -8px rgba(${accent.rgb},.45)`,
                }}
              >
                Entrar al Concesionario <ArrowRight className="h-4 w-4" />
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

        {/* Features */}
        <section
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(48px,6vw,80px)]"
          style={{
            backgroundColor: "var(--color-navy)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p
                className="text-[13px] font-bold uppercase tracking-[.16em] mb-3"
                style={{ color: accent.brand }}
              >
                Todo lo que incluye
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Funcionalidades del módulo
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "var(--color-navy-700)",
                    border: `1px solid rgba(${accent.rgb}, 0.15)`,
                  }}
                >
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `rgba(${accent.rgb}, 0.15)`,
                      color: accent.brand,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white mb-2" style={{ fontSize: 16 }}>
                      {title}
                    </h3>
                    <p className="leading-relaxed" style={{ fontSize: 14, color: "rgba(234,240,247,.65)" }}>
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="precios"
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(48px,6vw,80px)]"
          style={{
            backgroundColor: "var(--color-navy-900)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p
                className="text-[13px] font-bold uppercase tracking-[.16em] mb-3"
                style={{ color: accent.brand }}
              >
                Planes
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Elegí el plan para tu concesionaria
              </h2>
              <p
                className="mt-4 max-w-md mx-auto"
                style={{ fontSize: 15, color: "rgba(234,240,247,.6)" }}
              >
                Precios en dólares estadounidenses. Sin contrato de permanencia mínima.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Starter */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: `1px solid rgba(${accent.rgb}, 0.25)`,
                }}
              >
                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: accent.brand }}
                >
                  Starter
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Para agencias que arrancan con gestión digital
                </p>
                <div className="flex items-end gap-2 mb-6">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(34px,3.5vw,48px)" }}
                  >
                    USD 49
                  </span>
                  <span className="mb-1 font-semibold" style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}>
                    / mes
                  </span>
                </div>
                <div className="my-2 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
                <ul className="flex flex-col gap-3 mb-8 flex-1 mt-4">
                  {STARTER_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <PlanCheck />
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/nodo-autos/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: `linear-gradient(135deg, ${accent.brand}, ${accent.brand600})`,
                    boxShadow: `0 6px 20px -6px rgba(${accent.rgb},.4)`,
                  }}
                >
                  Empezar con Starter
                </Link>
              </div>

              {/* Pro */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #1a1a2e, #16213e)",
                  border: `2px solid rgba(${accent.rgb}, 0.5)`,
                  boxShadow: `0 20px 60px -20px rgba(${accent.rgb},.3), 0 0 0 1px rgba(${accent.rgb},.1)`,
                }}
              >
                <div className="absolute top-5 right-5">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{ background: `linear-gradient(135deg, ${accent.brand}, ${accent.brand600})` }}
                  >
                    Recomendado
                  </span>
                </div>
                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: accent.brand }}
                >
                  Pro
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Para concesionarias que publican y venden en serio
                </p>
                <div className="flex items-end gap-2 mb-6">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(34px,3.5vw,48px)" }}
                  >
                    USD 99
                  </span>
                  <span className="mb-1 font-semibold" style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}>
                    / mes
                  </span>
                </div>
                <div className="my-2 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
                <p
                  className="text-[12px] font-semibold uppercase tracking-wide mb-3 mt-4"
                  style={{ color: "rgba(234,240,247,.4)" }}
                >
                  Todo lo de Starter, más:
                </p>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <PlanCheck />
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.85)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/nodo-autos/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: `linear-gradient(135deg, ${accent.brand}, ${accent.brand600})`,
                    boxShadow: `0 6px 20px -6px rgba(${accent.rgb},.55)`,
                  }}
                >
                  Empezar con Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Enterprise */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: "1px solid rgba(255,255,255,.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4" style={{ color: accent.brand300 }} />
                  <p
                    className="text-[13px] font-bold uppercase tracking-[.14em]"
                    style={{ color: accent.brand300 }}
                  >
                    Enterprise
                  </p>
                </div>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Para grupos con varias sucursales o integraciones a medida
                </p>
                <div className="flex items-end gap-2 mb-6">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(34px,3.5vw,48px)" }}
                  >
                    USD 149
                  </span>
                  <span className="mb-1 font-semibold" style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}>
                    / mes
                  </span>
                </div>
                <div className="my-2 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
                <ul className="flex flex-col gap-3 mb-8 flex-1 mt-4">
                  {ENTERPRISE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <PlanCheck />
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:info@nodocore.com.ar?subject=Plan%20Enterprise%20Nodo%20Autos"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{ border: "1px solid rgba(255,255,255,.2)" }}
                >
                  Consultar Enterprise <Zap className="h-4 w-4" />
                </a>
              </div>
            </div>

            <p
              className="text-center mt-8"
              style={{ fontSize: 13, color: "rgba(234,240,247,.4)" }}
            >
              Todos los planes incluyen soporte técnico y actualizaciones sin costo adicional.
            </p>
          </div>
        </section>

        {/* Comparison */}
        <section
          className="pt-[clamp(32px,4vw,56px)] pb-[clamp(64px,8vw,112px)]"
          style={{
            backgroundColor: "var(--color-navy)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-10">
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(22px,2.5vw,32px)" }}
              >
                Comparativa de planes
              </h2>
            </div>

            <div
              className="overflow-x-auto rounded-2xl"
              style={{ border: "1px solid rgba(255,255,255,.07)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      background: `rgba(${accent.rgb}, 0.1)`,
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <th className="text-left px-5 py-4 font-bold text-white" style={{ fontSize: 13 }}>
                      Funcionalidad
                    </th>
                    {(["Starter", "Pro", "Enterprise"] as const).map((plan) => (
                      <th
                        key={plan}
                        className="px-5 py-4 text-center font-bold"
                        style={{ fontSize: 13, width: 100, color: accent.brand }}
                      >
                        {plan}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      style={{
                        background: i % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,.05)",
                      }}
                    >
                      <td className="px-5 py-3.5" style={{ color: "rgba(234,240,247,.75)", fontSize: 13 }}>
                        {row.label}
                      </td>
                      {(["starter", "pro", "enterprise"] as const).map((key) => (
                        <td key={key} className="px-5 py-3.5 text-center">
                          {row[key] ? (
                            <Check
                              className="h-4 w-4 mx-auto"
                              strokeWidth={2.5}
                              style={{ color: accent.brand }}
                            />
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
