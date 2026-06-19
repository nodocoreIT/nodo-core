"use client";

import Link from "next/link";
import Topbar from "@/components/panel/Topbar";
import { getNodeBySlug } from "@/lib/nodes";
import { getNodeAccentBySlug } from "@/lib/node-accents";
import {
  NODO_PLANS,
  STATUS_LABEL,
  isNodoPlanAccessible,
  type NodoPlanConfig,
  type NodoStatus,
} from "@/lib/nodo-plans";

const STATUS_BADGE: Record<
  NodoStatus,
  { bg: string; text: string }
> = {
  available: { bg: "rgba(31, 138, 91, 0.12)", text: "#1F8A5B" },
  development: { bg: "rgba(218, 90, 14, 0.12)", text: "#C04E0B" },
  planned: { bg: "rgba(45, 140, 255, 0.12)", text: "rgba(42, 111, 219, 1)" },
  not_started: { bg: "rgba(100, 120, 144, 0.12)", text: "var(--color-slate2)" },
};

function NodoCard({ nodo }: { nodo: NodoPlanConfig }) {
  const accent = getNodeAccentBySlug(nodo.slug);
  const nodeDef = getNodeBySlug(nodo.slug);
  const Icon = nodeDef?.Icon;
  const isClickable = isNodoPlanAccessible(nodo.status);
  const statusStyle = STATUS_BADGE[nodo.status];

  const card = (
    <div
      style={{
        background: `linear-gradient(145deg, rgba(${accent.rgb}, 0.1) 0%, #ffffff 52%)`,
        border: `1px solid rgba(${accent.rgb}, 0.28)`,
        borderLeft: `4px solid ${accent.brand}`,
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: isClickable ? "pointer" : "default",
        transition: "border-color 150ms, box-shadow 150ms, transform 150ms",
        opacity: nodo.status === "not_started" ? 0.72 : 1,
        minHeight: 168,
      }}
      onMouseEnter={(e) => {
        if (!isClickable) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = accent.brand;
        el.style.boxShadow = `0 8px 28px rgba(${accent.rgb}, 0.18)`;
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        if (!isClickable) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `rgba(${accent.rgb}, 0.28)`;
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {Icon && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 42,
                height: 42,
                borderRadius: 12,
                background: `rgba(${accent.rgb}, 0.16)`,
                color: accent.brand,
                flexShrink: 0,
              }}
            >
              <Icon size={20} strokeWidth={2.2} />
            </span>
          )}
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: accent.brand600,
              lineHeight: 1.25,
            }}
          >
            {nodo.label}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 999,
            padding: "3px 9px",
            background: statusStyle.bg,
            color: statusStyle.text,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {STATUS_LABEL[nodo.status]}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", lineHeight: 1.55 }}>
        {nodo.description}
      </p>

      {nodo.plans && (
        <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
            Starter USD {nodo.plans.starter.monthly}/mes
          </span>
          <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>·</span>
          <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
            Pro USD {nodo.plans.pro.monthly}/mes
          </span>
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/panel/unidades/${nodo.slug}`} style={{ textDecoration: "none" }}>
        {card}
      </Link>
    );
  }

  return card;
}

export default function UnidadesPage() {
  const activas = NODO_PLANS.filter((n) => isNodoPlanAccessible(n.status));
  const proximas = NODO_PLANS.filter((n) => !isNodoPlanAccessible(n.status));

  return (
    <>
      <Topbar breadcrumb="Nodo Core · Ecosistema" title="Unidades de negocio" />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--color-slate2)", maxWidth: 720 }}>
          Cada nodo es una unidad de negocio del ecosistema. Las tarjetas usan el color de marca de cada
          módulo. Hacé click en las unidades activas para ver detalle y planes.
        </p>

        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-slate2)",
            }}
          >
            Nodos activos
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {activas.map((nodo) => (
              <NodoCard key={nodo.slug} nodo={nodo} />
            ))}
          </div>
        </section>

        {proximas.length > 0 && (
          <section>
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-slate2)",
              }}
            >
              Próximamente
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {proximas.map((nodo) => (
                <NodoCard key={nodo.slug} nodo={nodo} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
