"use client";

import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { ECOMMERCE_ACCENT, getNodoLogoSrc } from "@/lib/node-accents";
import {
  ShoppingBag,
  Package,
  Truck,
  CreditCard,
  BarChart3,
  Users,
  Bot,
  Store,
  Check,
  ArrowRight,
} from "lucide-react";

const A = ECOMMERCE_ACCENT;
const ecommerceLogoSrc = getNodoLogoSrc("ecommerce");

const FEATURES = [
  {
    Icon: Package,
    title: "Catálogo de productos",
    description:
      "Cargá productos con variantes (talle, color), fotos, stock en tiempo real y categorías. Buscador avanzado para encontrar cualquier artículo al instante.",
  },
  {
    Icon: Users,
    title: "Gestión de proveedores",
    description:
      "Registrá proveedores, asociá productos a cada uno, seguí órdenes de compra y llevas el historial de precios para tomar mejores decisiones.",
  },
  {
    Icon: Store,
    title: "Panel de ventas",
    description:
      "Pedidos con estados (pendiente, en preparación, enviado, entregado). Vista unificada de todas las ventas: canal online y mostrador en un solo lugar.",
  },
  {
    Icon: CreditCard,
    title: "Pasarelas de pago",
    description:
      "Integraciones con Mercado Pago, transferencia bancaria y efectivo. Checkout optimizado para móvil con confirmación automática.",
  },
  {
    Icon: Truck,
    title: "Envíos integrados",
    description:
      "Cálculo de costos de envío, etiquetas de despacho y seguimiento de paquetes. Compatible con operadores propios y servicios de logística.",
  },
  {
    Icon: BarChart3,
    title: "Informes y analytics",
    description:
      "Dashboard con ventas por período, productos más vendidos, ticket promedio y stock crítico. Exportación a Excel para tu contador.",
  },
  {
    Icon: Bot,
    title: "Bot 24/7 + Automatizaciones",
    description:
      "Respuestas automáticas por WhatsApp, confirmación de pedidos, alertas de stock bajo y recordatorios de carrito abandonado.",
  },
  {
    Icon: Users,
    title: "Roles y accesos",
    description:
      "Admin, Vendedor y Depósito con permisos diferenciados. Sin instalación, acceso desde cualquier dispositivo.",
  },
];

const STARTER_FEATURES = [
  "Alta de productos con variantes y fotos",
  "Control de inventario en tiempo real",
  "Catálogo con buscador y filtros avanzados",
  "Pedidos con estados y trazabilidad",
  "Gestión de proveedores y órdenes de compra",
  "Panel de ventas (online + mostrador)",
  "Checkout con Mercado Pago y transferencia",
  "Roles Admin y Vendedor",
  "Dashboard de ventas básico",
  "Acceso web y móvil, sin instalación",
];

const PRO_EXTRAS = [
  "Portal de clientes con historial de compras",
  "Bot de WhatsApp 24/7 (pedidos y consultas)",
  "Alertas de stock bajo y carrito abandonado",
  "Integración de envíos con cálculo automático",
  "Estadísticas avanzadas y reportes por período",
  "Integración Gmail y Google Sheets",
  "Administración automática de redes sociales",
  "NODO ID: identificador único del ecosistema",
];

const COMPARISON_ROWS = [
  { label: "PRODUCTOS (Variantes, fotos, stock en tiempo real)", starter: true, pro: true },
  { label: "CATÁLOGO (Buscador, filtros, categorías)", starter: true, pro: true },
  { label: "PEDIDOS (Estados, trazabilidad, historial)", starter: true, pro: true },
  { label: "PROVEEDORES (Registro, órdenes de compra, historial de precios)", starter: true, pro: true },
  { label: "PAGOS (Mercado Pago, transferencia, efectivo)", starter: true, pro: true },
  { label: "VENTAS (Online + mostrador en panel unificado)", starter: true, pro: true },
  { label: "ROLES (Admin, Vendedor, Depósito)", starter: true, pro: true },
  { label: "DASHBOARD (Ventas básicas por período)", starter: true, pro: true },
  { label: "PORTAL CLIENTES (Historial de compras, seguimiento)", starter: false, pro: true },
  { label: "BOT 24/7 (WhatsApp, confirmaciones, carrito abandonado)", starter: false, pro: true },
  { label: "ENVÍOS (Cálculo automático, etiquetas, tracking)", starter: false, pro: true },
  { label: "ANALYTICS AVANZADOS (Reportes, exportación, comparativas)", starter: false, pro: true },
  { label: "INTEGRACIONES (Gmail, Google Sheets, Mercado Pago OAuth)", starter: false, pro: true },
  { label: "ADM. REDES SOCIALES (Automatización completa)", starter: false, pro: true },
  { label: "NODO ID · Llave de conexión (Ecosistema NODOS)", starter: false, pro: true },
];

export default function NodoEcommercePage() {
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
              background: `radial-gradient(60% 55% at 50% 38%, rgba(${A.rgb},.14), transparent 70%)`,
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span
              className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: `rgba(${A.rgb},.12)`, color: A.brand }}
            >
              <ShoppingBag className="h-9 w-9" strokeWidth={1.75} />
            </span>

            <p
              className="text-[13px] font-bold uppercase tracking-[.16em] mb-4"
              style={{ color: A.brand }}
            >
              Unidad del ecosistema
            </p>

            <h1
              className="font-display font-extrabold text-white flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/estrella%20bco%20nar.png" alt="" aria-hidden style={{ height: "0.78em", width: "auto", display: "inline-block" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ecommerceLogoSrc} alt="Nodo" style={{ height: "0.78em", width: "auto", display: "inline-block" }} />
              <span style={{ color: "#fff", fontWeight: 400 }}>|</span>
              Ecommerce
            </h1>

            <p
              className="max-w-[600px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              Montá y administrá tu e-commerce de manera profesional: productos,
              proveedores, ventas, pasarelas de pago y logística — todo integrado
              y accesible desde cualquier dispositivo.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/nodo-ecommerce/login?mode=register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-bold rounded-md text-black active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${A.brand}, ${A.brand600})`,
                  boxShadow: `0 8px 24px -8px rgba(${A.rgb},.45)`,
                }}
              >
                Empezar ahora <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white/80 hover:text-white transition-colors"
                style={{ border: "1px solid rgba(255,255,255,.15)" }}
              >
                Ver funcionalidades
              </a>
            </div>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────────────── */}
        <section
          id="funcionalidades"
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
                style={{ color: A.brand }}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map(({ Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "var(--color-navy-700)",
                    border: `1px solid rgba(${A.rgb},.15)`,
                  }}
                >
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `rgba(${A.rgb},.14)`, color: A.brand }}
                  >
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
              <p
                className="text-[13px] font-bold uppercase tracking-[.16em] mb-3"
                style={{ color: A.brand }}
              >
                Planes
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Elegí el plan para tu negocio
              </h2>
              <p
                className="mt-4 max-w-md mx-auto"
                style={{ fontSize: 15, color: "rgba(234,240,247,.6)" }}
              >
                Pago mensual o anual anticipado en dólares o al tipo de cambio
                del día. Sin contrato de permanencia mínima.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Starter */}
              <div
                className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
                style={{
                  background: "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: `1px solid rgba(${A.rgb},.25)`,
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(${A.rgb},.12), transparent 70%)`,
                  }}
                />

                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: A.brand }}
                >
                  Starter
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Ideal para emprendedores que quieren vender online de manera ordenada
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    USD 65
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Pago anual:{" "}
                  <span className="font-semibold" style={{ color: A.brand }}>
                    USD 55/mes
                  </span>{" "}
                  <span style={{ color: "rgba(234,240,247,.35)" }}>(USD 660/año)</span>
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {STARTER_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(${A.rgb},.18)`, color: A.brand }}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.78)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-ecommerce/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-black transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: `linear-gradient(135deg, ${A.brand}, ${A.brand600})`,
                    boxShadow: `0 6px 20px -6px rgba(${A.rgb},.45)`,
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
                  border: `2px solid rgba(${A.rgb},.5)`,
                  boxShadow: `0 20px 60px -20px rgba(${A.rgb},.3), 0 0 0 1px rgba(${A.rgb},.1)`,
                }}
              >
                <div className="absolute top-5 right-5">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-black"
                    style={{ background: `linear-gradient(135deg, ${A.brand}, ${A.brand600})` }}
                  >
                    Recomendado
                  </span>
                </div>

                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(${A.rgb},.18), transparent 70%)`,
                  }}
                />

                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] mb-1"
                  style={{ color: A.brand }}
                >
                  Pro
                </p>
                <p className="text-[13px] mb-5" style={{ color: "rgba(234,240,247,.45)" }}>
                  Para negocios que quieren escalar y conectarse al ecosistema
                </p>

                <div className="flex items-end gap-2 mb-1">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(38px,4vw,52px)" }}
                  >
                    USD 110
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 15, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p className="mb-1" style={{ fontSize: 13, color: "rgba(234,240,247,.45)" }}>
                  Pago anual:{" "}
                  <span className="font-semibold" style={{ color: A.brand }}>
                    USD 95/mes
                  </span>{" "}
                  <span style={{ color: "rgba(234,240,247,.35)" }}>(USD 1140/año)</span>
                </p>

                <div className="my-6 h-px" style={{ background: "rgba(255,255,255,.08)" }} />

                <p
                  className="text-[12px] font-semibold uppercase tracking-wide mb-3"
                  style={{ color: "rgba(234,240,247,.4)" }}
                >
                  Todo lo de Starter, más:
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {PRO_EXTRAS.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(${A.rgb},.18)`, color: A.brand }}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span style={{ fontSize: 14, color: "rgba(234,240,247,.85)" }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/nodo-ecommerce/login?mode=register"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[15px] font-bold rounded-xl text-black transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: `linear-gradient(135deg, ${A.brand}, ${A.brand600})`,
                    boxShadow: `0 6px 20px -6px rgba(${A.rgb},.55)`,
                  }}
                >
                  Empezar con Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

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

            <div
              className="overflow-x-auto rounded-2xl"
              style={{ border: "1px solid rgba(255,255,255,.07)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      background: `rgba(${A.rgb},.08)`,
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <th
                      className="text-left px-5 py-4 font-bold text-white"
                      style={{ fontSize: 13 }}
                    >
                      Funcionalidad
                    </th>
                    <th
                      className="px-5 py-4 text-center font-bold"
                      style={{ fontSize: 13, width: 110, color: A.brand }}
                    >
                      Starter
                    </th>
                    <th
                      className="px-5 py-4 text-center font-bold"
                      style={{ fontSize: 13, width: 110, color: A.brand }}
                    >
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
                      <td
                        className="px-5 py-3.5"
                        style={{ color: "rgba(234,240,247,.75)", fontSize: 13 }}
                      >
                        {row.label}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {row.starter ? (
                          <Check
                            className="h-4 w-4 mx-auto"
                            style={{ color: A.brand }}
                            strokeWidth={2.5}
                          />
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {row.pro ? (
                          <Check
                            className="h-4 w-4 mx-auto"
                            style={{ color: A.brand }}
                            strokeWidth={2.5}
                          />
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
