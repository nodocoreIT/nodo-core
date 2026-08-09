"use client";

import { useMemo, useState } from "react";
import Topbar from "@/components/panel/Topbar";
import { TriangleAlert } from "lucide-react";
import { NODO_CLINICA_ROADMAP } from "@/lib/panel/roadmap/nodo-clinica";
import type { NodoRoadmap, RoadmapItem, RoadmapSide, RoadmapStatus } from "@/lib/panel/roadmap/types";

const AVAILABLE_ROADMAPS: NodoRoadmap[] = [NODO_CLINICA_ROADMAP];

const STATUS_STYLES: Record<RoadmapStatus, { bg: string; color: string; label: string }> = {
  disponible: { bg: "#E1F0E8", color: "#1F8A5B", label: "Disponible" },
  parcial: { bg: "#FCE9D8", color: "#B5630C", label: "Parcial / con salvedades" },
  proximamente: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Próximamente" },
};

const SIDE_STYLES: Record<RoadmapSide, { bg: string; color: string; label: string }> = {
  medico: { bg: "#E3EDFC", color: "#2A6FDB", label: "Médico" },
  paciente: { bg: "#EDE9FE", color: "#6D28D9", label: "Paciente" },
  compartido: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Compartido" },
};

const SIDE_ORDER: RoadmapSide[] = ["medico", "paciente", "compartido"];
const SIDE_SECTION_TITLES: Record<RoadmapSide, string> = {
  medico: "Lado médico",
  paciente: "Lado paciente",
  compartido: "Funcionalidad compartida",
};

function StatusPill({ status }: { status: RoadmapStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const Icon = item.icon;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--color-mist)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--color-paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "var(--color-navy)",
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--color-navy)",
            fontFamily: "var(--font-display)",
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </h3>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", lineHeight: 1.5 }}>
        {item.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: "var(--color-paper)",
            color: "var(--color-slate2)",
          }}
        >
          {item.category}
        </span>
        <StatusPill status={item.status} />
      </div>
    </div>
  );
}

function CountsSummary({ items }: { items: RoadmapItem[] }) {
  const total = items.length;
  const counts = items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { disponible: 0, parcial: 0, proximamente: 0 } as Record<RoadmapStatus, number>,
  );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--color-navy)",
          fontFamily: "var(--font-display)",
        }}
      >
        {total} funcionalidades relevadas
      </span>
      {(Object.keys(counts) as RoadmapStatus[]).map((status) => (
        <span
          key={status}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "var(--color-slate2)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: STATUS_STYLES[status].color,
            }}
          />
          {counts[status]} {STATUS_STYLES[status].label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}

export default function RoadmapPage() {
  const [activeNodoCode, setActiveNodoCode] = useState(AVAILABLE_ROADMAPS[0]?.nodoCode ?? "");
  const roadmap = useMemo(
    () => AVAILABLE_ROADMAPS.find((r) => r.nodoCode === activeNodoCode) ?? null,
    [activeNodoCode],
  );

  const itemsBySide = useMemo(() => {
    const grouped: Record<RoadmapSide, RoadmapItem[]> = { medico: [], paciente: [], compartido: [] };
    for (const item of roadmap?.items ?? []) grouped[item.side].push(item);
    return grouped;
  }, [roadmap]);

  return (
    <>
      <Topbar breadcrumb="Nodo Core · Panel" title="Roadmap de producto" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--color-slate2)", maxWidth: 760 }}>
          Referencia para el equipo de QA: qué hace hoy cada nodo de producto, del lado médico y del lado
          paciente, y qué está parcial o pendiente. Se actualiza a mano cuando cambia el producto — no
          refleja el estado en tiempo real de la base de código.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {AVAILABLE_ROADMAPS.map((r) => {
            const active = r.nodoCode === activeNodoCode;
            return (
              <button
                key={r.nodoCode}
                type="button"
                onClick={() => setActiveNodoCode(r.nodoCode)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: active ? "1px solid var(--color-brand)" : "1px solid var(--color-mist)",
                  background: active ? "var(--color-brand)" : "white",
                  color: active ? "white" : "var(--color-slate2)",
                }}
              >
                {r.nodoLabel}
              </button>
            );
          })}
          <span
            style={{
              alignSelf: "center",
              fontSize: 12.5,
              color: "var(--color-slate2)",
              opacity: 0.7,
            }}
          >
            Más nodos, a medida que se releven.
          </span>
        </div>

        {!roadmap ? (
          <div
            style={{
              background: "white",
              border: "1px solid var(--color-mist)",
              borderRadius: 12,
              padding: 48,
              textAlign: "center",
              color: "var(--color-slate2)",
            }}
          >
            Todavía no hay un roadmap relevado para este nodo.
          </div>
        ) : (
          <>
            <div
              style={{
                background: "white",
                border: "1px solid var(--color-mist)",
                borderRadius: 12,
                padding: "14px 18px",
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <CountsSummary items={roadmap.items} />
              <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
                Actualizado el {new Date(roadmap.updatedAt).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            {SIDE_ORDER.map((side) => {
              const items = itemsBySide[side];
              if (items.length === 0) return null;
              const sideStyle = SIDE_STYLES[side];
              return (
                <div key={side} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 17,
                        fontWeight: 700,
                        color: "var(--color-navy)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {SIDE_SECTION_TITLES[side]}
                    </h2>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: sideStyle.bg,
                        color: sideStyle.color,
                      }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {items.map((item) => (
                      <RoadmapCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}

            {roadmap.qaNotes.length > 0 && (
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 12,
                  padding: 18,
                  marginTop: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <TriangleAlert className="h-4 w-4" style={{ color: "#B5630C" }} />
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#92400E",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    Puntos para verificar con más cuidado
                  </h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                  {roadmap.qaNotes.map((note) => (
                    <li key={note} style={{ fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
