"use client";

import Link from "next/link";
import Topbar from "@/components/panel/Topbar";
import { NODO_PLANS, STATUS_LABEL, STATUS_COLOR, type NodoPlanConfig } from "@/lib/nodo-plans";

function NodoCard({ nodo }: { nodo: NodoPlanConfig }) {
  const statusStyle = STATUS_COLOR[nodo.status];
  const isClickable = nodo.status === "development";

  const card = (
    <div
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${isClickable ? "rgba(218,90,14,.25)" : "rgba(255,255,255,.06)"}`,
        borderRadius: 12,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: isClickable ? "pointer" : "default",
        transition: "border-color 150ms, box-shadow 150ms",
        opacity: nodo.status === "not_started" ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-brand)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(218,90,14,.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(218,90,14,.25)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
          {nodo.label}
        </p>
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
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", lineHeight: 1.5 }}>
        {nodo.description}
      </p>
      {nodo.plans && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
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
  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Ecosistema"
        title="Unidades de negocio"
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--color-slate2)" }}>
          Cada nodo es una unidad de negocio del ecosistema. Hacé click en los que están en desarrollo para ver y gestionar sus planes.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {NODO_PLANS.map((nodo) => (
            <NodoCard key={nodo.slug} nodo={nodo} />
          ))}
        </div>
      </div>
    </>
  );
}
