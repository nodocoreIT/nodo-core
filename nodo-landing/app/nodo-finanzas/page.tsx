"use client";

import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import {
  Coins,
  Bell,
  CreditCard,
  BarChart3,
  CalendarCheck,
  Wallet,
  TrendingUp,
  Check,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    Icon: Bell,
    title: "Alertas de vencimientos",
    description:
      "Recibís notificaciones automáticas de tarjetas, cuotas de préstamos y planes de ahorro antes de que venzan.",
  },
  {
    Icon: CreditCard,
    title: "Control de tarjetas de crédito",
    description:
      "Seguimiento completo de consumos por período de facturación, cuotas automáticas y cálculo del cierre mensual.",
  },
  {
    Icon: BarChart3,
    title: "Gráficos de gastos",
    description:
      "Visualizá en un gráfico claro en dónde se va tu dinero: desglose por rubro, evolución diaria y comparativa mensual.",
  },
  {
    Icon: CalendarCheck,
    title: "Detalle mensual de consumos",
    description:
      "Informe mensual completo con todos tus gastos, tarjetas, préstamos y planes de ahorro en un solo lugar.",
  },
  {
    Icon: Wallet,
    title: "Gastos diarios y fijos",
    description:
      "Registrá cada gasto del día o configurá tus gastos fijos recurrentes. Múltiples cuentas y formas de pago.",
  },
  {
    Icon: TrendingUp,
    title: "Préstamos y planes de ahorro",
    description:
      "Gestioná tus cuotas de préstamos y planes de ahorro con cronograma de pagos y seguimiento de saldo.",
  },
];

const PLAN_FEATURES = [
  "Gastos diarios ilimitados",
  "Gastos fijos recurrentes",
  "Hasta 5 tarjetas de crédito",
  "Control de cuotas y períodos",
  "Gestión de préstamos",
  "Planes de ahorro",
  "Múltiples cuentas (ARS / USD)",
  "Informe mensual con gráficos",
  "Alertas de vencimientos",
  "Cotización del dólar en tiempo real",
  "Acceso desde cualquier dispositivo",
];

export default function NodoFinanzasPage() {
  return (
    <div style={{ backgroundColor: "var(--color-navy-900)" }}>
      <Navbar />
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden pt-[clamp(90px,7vw,120px)] pb-[clamp(32px,5vw,56px)]"
          style={{ backgroundColor: "var(--color-navy-900)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 55% at 50% 38%, rgba(5,150,105,.15), transparent 70%)",
            }}
          />

          <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
            <span className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Coins className="h-9 w-9" strokeWidth={1.75} />
            </span>

            <p className="text-[13px] font-bold uppercase tracking-[.16em] text-emerald-400 mb-4">
              Módulo de Nodo IT
            </p>

            <h1
              className="font-display font-extrabold text-white"
              style={{ fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.06 }}
            >
              Finanzas Personales
            </h1>

            <p
              className="max-w-[560px] mx-auto mt-6 leading-relaxed"
              style={{
                fontSize: "clamp(17px,1.5vw,21px)",
                color: "rgba(234,240,247,.72)",
              }}
            >
              Tu panel de control financiero. Gastos, tarjetas, préstamos y
              planes de ahorro en un solo lugar — con reportes visuales y
              alertas automáticas.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/finanzas"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-[16px] font-bold rounded-md text-white active:scale-[.98] transition-all duration-150 shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #059669, #047857)",
                  boxShadow: "0 8px 24px -8px rgba(5,150,105,.45)",
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

        {/* ── Features grid ────────────────────────────────────────────── */}
        <section
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(48px,6vw,80px)]"
          style={{
            backgroundColor: "var(--color-navy)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-bold uppercase tracking-[.16em] text-emerald-400 mb-3">
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
                    border: "1px solid rgba(5,150,105,.15)",
                  }}
                >
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
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

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <section
          id="precios"
          className="pt-[clamp(48px,6vw,80px)] pb-[clamp(64px,8vw,112px)]"
          style={{
            backgroundColor: "var(--color-navy-900)",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div className="w-[min(1200px,92vw)] mx-auto">
            <div className="text-center mb-14">
              <p className="text-[13px] font-bold uppercase tracking-[.16em] text-emerald-400 mb-3">
                Suscripción mensual
              </p>
              <h2
                className="font-display font-extrabold text-white"
                style={{ fontSize: "clamp(26px,3vw,40px)" }}
              >
                Un precio, todo incluido
              </h2>
              <p
                className="mt-4 max-w-md mx-auto"
                style={{ fontSize: 15, color: "rgba(234,240,247,.6)" }}
              >
                Sin planes confusos ni funcionalidades bloqueadas. Accés a todo
                el módulo desde el primer día.
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div
                className="rounded-2xl p-8 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(145deg, var(--color-navy-700), var(--color-navy))",
                  border: "1px solid rgba(5,150,105,.3)",
                  boxShadow:
                    "0 20px 60px -20px rgba(5,150,105,.25), 0 0 0 1px rgba(5,150,105,.08)",
                }}
              >
                {/* Glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(5,150,105,.2), transparent 70%)",
                  }}
                />

                <p
                  className="text-[13px] font-bold uppercase tracking-[.14em] text-emerald-400 mb-6"
                >
                  Plan completo
                </p>

                {/* Price */}
                <div className="flex items-end gap-2 mb-2">
                  <span
                    className="font-display font-extrabold text-white leading-none"
                    style={{ fontSize: "clamp(42px,5vw,56px)" }}
                  >
                    U$S 4.99
                  </span>
                  <span
                    className="mb-2 font-semibold"
                    style={{ fontSize: 16, color: "rgba(234,240,247,.5)" }}
                  >
                    / mes
                  </span>
                </div>
                <p
                  className="mb-8"
                  style={{ fontSize: 13, color: "rgba(234,240,247,.4)" }}
                >
                  Precio final en dólares · IVA incluido
                </p>

                {/* Feature list */}
                <ul className="flex flex-col gap-3 mb-10">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                      <span
                        style={{
                          fontSize: 14.5,
                          color: "rgba(234,240,247,.78)",
                        }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/finanzas"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-[16px] font-bold rounded-xl text-white transition-all duration-150 active:scale-[.98]"
                  style={{
                    background: "linear-gradient(135deg, #059669, #047857)",
                    boxShadow: "0 6px 20px -6px rgba(5,150,105,.5)",
                  }}
                >
                  Empezar ahora <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
