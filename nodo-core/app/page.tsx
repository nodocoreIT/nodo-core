import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import ContactForm from "@/components/ui/ContactForm";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EcosystemDiagram from "@/components/EcosystemDiagram";
import { NODES, type NodeDef } from "@/lib/nodes";
import { Activity, Headset, TrendingUp } from "lucide-react";

// ─── Data ───────────────────────────────────────────────────────────────────

const BENEFIT_CARDS = [
  {
    title: "Visibilidad en tiempo real",
    description:
      "Avances, datos financieros y gestión, siempre disponibles desde una plataforma personalizada para su operación.",
    Icon: Activity,
  },
  {
    title: "Un único interlocutor",
    description:
      "Elimine la fragmentación: Nodo es el único punto de contacto para todas sus unidades de negocio.",
    Icon: Headset,
  },
  {
    title: "Oportunidades, no solo soluciones",
    description:
      "Pasamos de resolver problemas a generar oportunidades de negocio, incluso formando grupos inversores.",
    Icon: TrendingUp,
  },
];

const PILLS = ["Inmo", "Obra", "Capital", "IT", "Legal", "Agro", "Contable"];

// ─── Shared layout helpers ───────────────────────────────────────────────────

function SectionWrapper({
  children,
  id,
  className = "",
  style,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      className={`py-[clamp(64px,9vw,132px)] ${className}`}
      style={style}
    >
      <div className="w-[min(1200px,92vw)] mx-auto">{children}</div>
    </section>
  );
}

function Eyebrow({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <p
      className={`text-[13px] font-bold uppercase tracking-[.16em] mb-4 ${
        light ? "text-brand-300" : "text-brand"
      }`}
    >
      {children}
    </p>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative overflow-hidden pt-[140px] pb-[clamp(64px,9vw,120px)]"
      style={{ backgroundColor: "var(--color-navy-900)" }}
    >
      {/* Glow pseudo-layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 38%, rgba(218,90,14,.18), transparent 70%)",
        }}
      />

      <div className="w-[min(1200px,92vw)] mx-auto relative z-10 flex flex-col items-center text-center">
        {/* Eyebrow */}
        <RevealOnScroll>
          <p className="text-[13px] font-bold uppercase tracking-[.16em] text-brand mb-5">
            El ecosistema que centraliza, conecta y potencia
          </p>
        </RevealOnScroll>

        {/* H1 */}
        <RevealOnScroll delay={80}>
          <h1
            className="font-display font-extrabold text-white max-w-[780px] mx-auto"
            style={{ fontSize: "clamp(40px,6vw,76px)", lineHeight: 1.05 }}
          >
            El <span className="text-brand">núcleo</span> que conecta todo su
            negocio
          </h1>
        </RevealOnScroll>

        {/* Lead */}
        <RevealOnScroll delay={160}>
          <p
            className="max-w-[600px] mx-auto mt-6 leading-relaxed"
            style={{
              fontSize: "clamp(17px,1.5vw,21px)",
              color: "rgba(234,240,247,.72)",
            }}
          >
            Una sola plataforma que articula cada unidad —inmobiliaria, obra,
            capital, legal y más— con transparencia tecnológica y control en
            tiempo real.
          </p>
        </RevealOnScroll>

        {/* Ecosystem diagram */}
        <RevealOnScroll delay={240} className="w-full">
          <EcosystemDiagram
            dark
            interactive
            className="w-full max-w-[560px] aspect-square mx-auto mt-[26px]"
          />
        </RevealOnScroll>

        {/* TODO VEER SI VUELAN O NO ESTAS LINEAS */}

        {/* CTAs */}
        {/* <RevealOnScroll delay={320}>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <a
              href="#contacto"
              className="inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md bg-brand text-white hover:bg-brand-600 active:scale-[.98] transition-all duration-150"
            >
              Solicitar una demo
            </a>
            <a
              href="#filosofia"
              className="btn-ghost-light inline-flex items-center justify-center px-7 py-3.5 text-[16px] font-semibold rounded-md text-white"
            >
              Conocer el ecosistema
            </a>
          </div>
        </RevealOnScroll> */}

        {/* Pill {/* <RevealOnScroll delay={400}>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {PILLS.map((pill) => (
              <span
                key={pill}
                className="rounded-full font-semibold"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(234,240,247,.78)",
                  border: "1px solid rgba(255,255,255,.14)",
                  padding: "8px 15px",
                  background: "rgba(255,255,255,.03)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </RevealOnScroll>s */}
      </div>
    </section>
  );
}

function FilosofiaSection() {
  return (
    <SectionWrapper
      id="filosofia"
      style={{
        backgroundColor: "var(--color-navy-900)",
        borderTop: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <div
        className="filosofia-grid grid gap-[60px]"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {/* Left */}
        <RevealOnScroll>
          <div>
            <Eyebrow>Qué es Nodo</Eyebrow>
            <blockquote
              className="font-display font-semibold text-white m-0"
              style={{ fontSize: "clamp(24px,2.8vw,38px)", lineHeight: 1.15 }}
            >
              No somos un conjunto de empresas. Somos un{" "}
              <span className="text-brand">
                ecosistema de gestión inteligente.
              </span>
            </blockquote>
          </div>
        </RevealOnScroll>

        {/* Right */}
        <RevealOnScroll delay={120}>
          <div className="flex flex-col gap-6 justify-center">
            <p
              className="text-[16px] leading-relaxed pl-[22px]"
              style={{
                color: "rgba(234,240,247,.72)",
                borderLeft: "2px solid var(--color-brand)",
              }}
            >
              Un {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/nodo%20nar.png"
                alt="nodo"
                style={{
                  height: "0.82em",
                  width: "auto",
                  display: "inline-block",
                  verticalAlign: "-0.04em",
                  margin: "0 2px",
                }}
              />{" "}
              es el punto de intersección donde convergen distintas ramas. El{" "}
              <strong>Core</strong> es ese punto central que irradia soluciones
              hacia cada unidad especializada.
            </p>
            <p
              className="text-[15.5px] leading-relaxed"
              style={{ color: "rgba(234,240,247,.62)" }}
            >
              La tecnología no es solo una herramienta: es el eje que une y da
              transparencia a todas las unidades de negocio. En cada una, el
              cliente accede a una plataforma propia con control total.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </SectionWrapper>
  );
}

function UnidadesSection() {
  return (
    <SectionWrapper
      id="unidades"
      style={{ backgroundColor: "var(--color-navy)" }}
    >
      {/* Header */}
      <RevealOnScroll>
        <div className="mb-12">
          <Eyebrow>Funcionalidades · Qué ofrecemos</Eyebrow>
          <h2
            className="font-display font-bold text-white"
            style={{ fontSize: "clamp(28px,3.4vw,44px)" }}
          >
            Una estructura de convergencia de servicios de alto valor
          </h2>
        </div>
      </RevealOnScroll>

      {/* Units list */}
      <div className="flex flex-col">
        {NODES.map((node, i) => (
          <RevealOnScroll key={node.slug} delay={i * 40}>
            <UnidadRow node={node} index={String(i + 1).padStart(2, "0")} />
          </RevealOnScroll>
        ))}
      </div>
    </SectionWrapper>
  );
}

function UnidadRow({ node, index }: { node: NodeDef; index: string }) {
  const { Icon } = node;
  return (
    <Link
      href={`/nodo-${node.slug}`}
      prefetch
      className="unidad-row group grid items-center gap-6 py-5 px-2 cursor-pointer transition-all duration-200 rounded-sm hover:pl-4"
      style={{
        gridTemplateColumns: "70px 1fr 1.4fr auto",
        borderBottom: "1px solid rgba(255,255,255,.1)",
      }}
    >
      {/* Index */}
      <span className="font-display font-bold text-brand text-[15px]">
        {index}
      </span>

      {/* Tag */}
      <span className="flex items-center gap-3 font-display font-bold text-white text-[20px]">
        <Icon
          className="w-5 h-5 text-white shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/nodo%20nar.png"
            alt="nodo"
            style={{ height: "0.7em", width: "auto", display: "inline-block" }}
          />
          <span className="text-white font-normal mx-[.3em]">|</span>
          {node.code}
        </span>
      </span>

      {/* Description */}
      <span
        className="unidad-desc text-[14.5px]"
        style={{ color: "rgba(234,240,247,.65)" }}
      >
        {node.description}
      </span>

      {/* Arrow */}
      <div
        className="unidad-arrow w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-200 group-hover:bg-brand group-hover:border-brand"
        style={{ borderColor: "rgba(255,255,255,.2)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-white/50 group-hover:text-white transition-colors duration-200"
        >
          <path
            d="M3 8h10M9 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Link>
  );
}

function BeneficiosSection() {
  return (
    <SectionWrapper
      id="beneficios"
      style={{ backgroundColor: "var(--color-paper)" }}
    >
      {/* Header */}
      <RevealOnScroll>
        <div className="mb-10">
          <Eyebrow>Beneficios para el cliente</Eyebrow>
          <h2
            className="font-display font-bold text-ink"
            style={{ fontSize: "clamp(28px,3.4vw,44px)" }}
          >
            Transformamos información en control total
          </h2>
        </div>
      </RevealOnScroll>

      {/* Cards */}
      <div
        className="benefits-grid grid gap-[22px]"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {BENEFIT_CARDS.map((card, i) => (
          <RevealOnScroll key={card.title} delay={i * 80} className="h-full">
            <BenefitCard card={card} />
          </RevealOnScroll>
        ))}
      </div>
    </SectionWrapper>
  );
}

function BenefitCard({ card }: { card: (typeof BENEFIT_CARDS)[number] }) {
  const { Icon } = card;
  return (
    <div
      className="h-full rounded-lg p-[30px] bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ border: "1px solid var(--color-mist)" }}
    >
      {/* Icon */}
      <div
        className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center mb-5"
        style={{ backgroundColor: "var(--color-navy)" }}
      >
        <Icon
          className="w-[22px] h-[22px] text-brand"
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </div>

      <h3
        className="font-display font-bold mb-3 text-ink"
        style={{ fontSize: 19 }}
      >
        {card.title}
      </h3>
      <p
        className="leading-relaxed m-0"
        style={{ fontSize: 14.5, color: "var(--color-slate2)" }}
      >
        {card.description}
      </p>
    </div>
  );
}

function ContactoSection() {
  return (
    <SectionWrapper
      id="contacto"
      style={{ backgroundColor: "var(--color-navy-900)" }}
    >
      <RevealOnScroll>
        <div
          className="rounded-xl p-[40px]"
          style={{
            backgroundColor: "var(--color-navy)",
            border: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div
            className="contacto-grid grid gap-[48px]"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            {/* Left: info */}
            <div>
              <Eyebrow>Contacto</Eyebrow>
              <h2
                className="font-display font-bold text-white mb-4"
                style={{ fontSize: "clamp(26px,3vw,38px)" }}
              >
                Llevemos su operación a un solo núcleo
              </h2>
              <p
                className="text-[16px] leading-relaxed mb-8"
                style={{ color: "rgba(234,240,247,.7)" }}
              >
                Cuéntenos qué necesita gestionar y le mostramos cómo Nodo Core
                centraliza su negocio con total transparencia.
              </p>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="text-[15px]"
                    style={{ color: "rgba(234,240,247,.8)" }}
                  >
                    ✉ contacto@nodocore.com
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[15px]"
                    style={{ color: "rgba(234,240,247,.8)" }}
                  >
                    ◎ Atención profesional y personalizada
                  </span>
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div className="h-full">
              <ContactForm />
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </SectionWrapper>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ backgroundColor: "var(--color-navy-900)" }}>
      <Navbar />
      <main>
        <HeroSection />
        <FilosofiaSection />
        <UnidadesSection />
        <BeneficiosSection />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  );
}
