"use client";

import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import {
  Building2,
  FileText,
  Wallet,
  Users,
  TrendingUp,
  Check,
  ArrowRight,
  Bot,
} from "lucide-react";

const FEATURES = [
  {
    Icon: Building2,
    title: "Gestión de propiedades",
    description:
      "Ficha completa con fotos, documentos y estados. Buscador avanzado y web interna para compartir propiedades con clientes.",
  },
  {
    Icon: FileText,
    title: "Contratos de alquiler",
    description:
      "Cálculo automático de aumentos por ICL/IPC y alertas de vencimiento para que nunca se te pase una fecha clave.",
  },
  {
    Icon: Wallet,
    title: "Caja y cobros",
    description:
      "Cobros de alquiler y expensas, cuentas bancarias, caja chica e informe de morosidad en un solo panel.",
  },
  {
    Icon: TrendingUp,
    title: "Pipeline de ventas",
    description:
      "Seguimiento de interesados y reservas. Visualizá en qué etapa está cada operación y qué necesita atención.",
  },
  {
    Icon: Users,
    title: "Roles y usuarios",
    description:
      "Admin, Agentes, Propietarios e Inquilinos con acceso diferenciado. Sin instalación, desde cualquier dispositivo.",
  },
  {
    Icon: Bot,
    title: "Bot 24/7 + Automatizaciones",
    description:
      "Responde consultas por WhatsApp automáticamente, avisa vencimientos y genera contratos desde los datos cargados.",
  },
];

const COMPARISON_ROWS = [
  { label: "PROPIEDADES (Ficha completa, Fotos, Documentos, Estados)", starter: true, pro: true },
  { label: "CONTRATOS DE ALQUILER (Cálculo aumentos ICL/IPC, Alertas vencimiento)", starter: true, pro: true },
  { label: "CAJA Y COBROS (Alquileres, Expensas, Efectivo/Transferencia, Caja chica)", starter: true, pro: true },
  { label: "VENTAS (Pipeline: interesado, reserva)", starter: true, pro: true },
  { label: "USUARIOS (Roles Admin, Agentes, Acceso web/móvil)", starter: true, pro: true },
  { label: "PORTAL PROPIETARIO (Acceso web)", starter: false, pro: true },
  { label: "PORTAL INQUILINOS (Contrato, Pagos, Reclamos y seguimiento)", starter: false, pro: true },
  { label: "BOT 24/7 + AUTOMATIZACIONES (WhatsApp, Avisos, Estadísticas)", starter: false, pro: true },
  { label: "INTEGRACIONES (Gmail, Sheets, Mercado Pago)", starter: false, pro: true },
  { label: "ADM. REDES SOCIALES (Automatización completa)", starter: false, pro: true },
  { label: "GENERACIÓN DE CONTRATOS (Aut. desde Prop./Prop./Inq.)", starter: false, pro: true },
  { label: "NODO ID · Llave de conexión (Ecosistema NODOS, Identificador único)", starter: false, pro: true },
];

const STARTER_FEATURES = [
  "Alta y ficha completa de cada propiedad",
  "Fotos y documentos adjuntos",
  "Estados: disponible, alquilada o vendida",
  "Búsqueda y filtros avanzados",
  "Web interna con detalle de propiedad",
  "Cálculo automático de aumentos ICL/IPC",
  "Alertas de vencimiento de contrato",
  "Cobros: efectivo y transferencia",
  "Cuentas bancarias y caja chica",
  "Historial de pagos e informe de morosidad",
  "Pipeline de ventas (interesado, reserva)",
  "Roles Admin y Agentes",
  "Acceso web y móvil, sin instalación",
];

const PRO_EXTRAS = [
  "Portal Propietario con Rol Propietario",
  "Portal Inquilinos: contrato, pagos y reclamos",
  "Avisos de vencimiento, aumentos y mora",
  "Estadísticas de ventas por empleado",
  "Integración Gmail, Google Sheets, Mercado Pago",
  "Administración automática de redes sociales",
  "Generación automática de contratos",
  "NODO ID: identificador único del ecosistema",
];

export default function NodoInmoPage() {
  return (
    <div style={{ backgroundColor: "var(--color-navy-900)" }}>
      <Navbar />
      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden pt-[clamp(90px,7vw,120px)] pb-[clamp(32px,5vw,56px)]"
          style={{ backgroundColor: "var(--color-navy-900)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 38%, rgba(234,88,12,.13), transparent 70%)",
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
              <Building2 className="h-9 w-9" strokeWidth={1.75} />
            </span>

            <p className="text-[13px] font-bold uppercase tracking-[.16em] text-orange-400 mb-4">
              Módulo de Nodo Core
            </p>

            <h1
              className="font-display font-extrabold text-white"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              Tu inmobiliaria,{" "}
              <span style={{ color: "#f97316" }}>en un solo lugar</span>
            </h1>

            <p
              className="max-w-[580px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              Propiedades, contratos, cobros, ventas y portales para
              propietarios e inquilinos — todo integrado y accesible desde
              cualquier dispositivo.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/nodo-inmo/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #ea580c, #c2410c)",
                  boxShadow: "0 8px 24px -8px rgba(234,88,12,.45)",
                }}
              >
                Entrar al módulo <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#precios"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white/80 hover:text-white transition-colors"
                style={{ border: "1px solid rgba(255,255,255,.15)" }}
              >
                Ver precios
              </a>
            </div>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────── */}
        <section
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(48px,6vw,80px)]"
          style={{
            backgroundColor: "var(--color-navy)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-bold uppercase tracking-[.16em] text-orange-400 mb-3">
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
                    border: "1px solid rgba(234,88,12,.15)",
                  }}
                >
                  <div className="h-10 w-10 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      className="font-display font-bold text-white mb-2"
                      style={{ fontSize: 16 }}
                    >
                      {title}
                    </h3>
                    <p
                      className="leading-relaxed"
                      style={{ fontSize: 14, color: "rgba(234,240,247,.65)" }}
                    >
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
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
              <p className="text-[13px] font-bold uppercase tracking-[.16em] text-orange-400 mb-3">
                Planes
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Elegí el plan que necesita tu inmobiliaria
              </h2>
              <p
                className="mt-4 max-w-md mx-auto"
                style={{ fontSize: 15, color: "rgba(234,240,247,.6)" }}
              >
                Pago mensual o anual anticipado en dólares o al tipo de cambio
                del día. Sin contrato de permanencia mínima.
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

              {/* Starter */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: "1px solid rgba(234,88,12,.25)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(234,88,12,.15), transparent 70%)",
                  }}
                />

                <p className="text-[13px] font-bold uppercase tracking-[.14em] text-orange-400 mb-1">
                  Starter
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Ideal para inmobiliarias que quieren organizarse digitalmente
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    USD 75
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Pago anual: <span className="text-orange-400 font-semibold">USD 65/mes</span>{" "}
                  <span style={{ color: "rgba(234,240,247,.35)" }}>(USD 780/año)</span>
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {STARTER_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-inmo/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: "linear-gradient(135deg, #ea580c, #c2410c)",
                    boxShadow: "0 6px 20px -6px rgba(234,88,12,.45)",
                  }}
                >
                  Empezar con Starter <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Pro */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, #1a1a2e, #16213e)",
                  border: "2px solid rgba(234,88,12,.5)",
                  boxShadow: "0 20px 60px -20px rgba(234,88,12,.3), 0 0 0 1px rgba(234,88,12,.1)",
                }}
              >
                {/* Badge */}
                <div className="absolute top-5 right-5">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
                  >
                    Recomendado
                  </span>
                </div>

                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(234,88,12,.2), transparent 70%)",
                  }}
                />

                <p className="text-[13px] font-bold uppercase tracking-[.14em] text-orange-400 mb-1">
                  Pro
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Para inmobiliarias que quieren automatizar y conectarse al ecosistema
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    USD 125
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Pago anual: <span className="text-orange-400 font-semibold">USD 115/mes</span>{" "}
                  <span style={{ color: "rgba(234,240,247,.35)" }}>(USD 1380/año)</span>
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "rgba(234,240,247,.4)" }}>
                  Todo lo de Starter, más:
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {PRO_EXTRAS.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.85)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-inmo/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: "linear-gradient(135deg, #ea580c, #c2410c)",
                    boxShadow: "0 6px 20px -6px rgba(234,88,12,.55)",
                  }}
                >
                  Empezar con Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Note */}
            <p
              className="text-center mt-8"
              style={{ fontSize: 13, color: "rgba(234,240,247,.4)" }}
            >
              Ambos planes incluyen soporte técnico y actualizaciones sin costo adicional.
            </p>
          </div>
        </section>

        {/* ── Comparison table ──────────────────────────────────────────── */}
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

            <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,.07)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(234,88,12,.1)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                    <th className="text-left px-5 py-4 font-bold text-white" style={{ fontSize: 13 }}>
                      Funcionalidad
                    </th>
                    <th className="px-5 py-4 text-center font-bold text-orange-400" style={{ fontSize: 13, width: 110 }}>
                      Starter
                    </th>
                    <th className="px-5 py-4 text-center font-bold text-orange-400" style={{ fontSize: 13, width: 110 }}>
                      Pro
                    </th>
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
                      <td className="px-5 py-3.5 text-center">
                        {row.starter ? (
                          <Check className="h-4 w-4 text-orange-400 mx-auto" strokeWidth={2.5} />
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {row.pro ? (
                          <Check className="h-4 w-4 text-orange-400 mx-auto" strokeWidth={2.5} />
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
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
