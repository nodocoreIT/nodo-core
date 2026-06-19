"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { annualMonthlyFromMonthly } from "@/lib/panel/planes";
import {
  deleteFeature,
  deleteFeatureGroup,
  deletePlan,
  loadUnitPlanConfig,
  saveUnitPlanConfig,
  type EditableFeature,
  type EditableGroup,
  type EditablePlan,
} from "@/lib/panel/plan-admin";
import type { NodeDef } from "@/lib/nodes";

const PLAN_HEADER_COLORS = [
  "var(--color-brand)",
  "var(--color-navy-900)",
  "#5B21B6",
  "#0D9488",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--color-mist)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  outline: "none",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-slate2)",
  background: "var(--color-mist-200)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid var(--color-mist)",
  fontSize: 13,
  verticalAlign: "middle",
};

type UnitPlanEditorProps = {
  node: NodeDef;
};

function tempId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function UnitPlanEditor({ node }: UnitPlanEditorProps) {
  const unitCode = node.code;
  const [planes, setPlanes] = useState<EditablePlan[]>([]);
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [features, setFeatures] = useState<EditableFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activePlanes = useMemo(
    () => [...planes].filter((plan) => plan.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [planes],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const config = await loadUnitPlanConfig(supabase, unitCode);
    setPlanes(config.planes);
    setGroups(config.groups);
    setFeatures(config.features);
    setLoading(false);
  }, [unitCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function updatePlan(planId: string, patch: Partial<EditablePlan>) {
    setPlanes((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) return plan;
        const next = { ...plan, ...patch };
        if (patch.price_monthly !== undefined && patch.price_annual_monthly === undefined) {
          next.price_annual_monthly = annualMonthlyFromMonthly(Number(patch.price_monthly) || 0);
        }
        return next;
      }),
    );
  }

  function addPlan() {
    const sortOrder = planes.length > 0 ? Math.max(...planes.map((plan) => plan.sort_order)) + 1 : 1;
    setPlanes((prev) => [
      ...prev,
      {
        id: tempId("new-plan"),
        unit_code: unitCode,
        code: "",
        label: "",
        price_monthly: 0,
        price_annual_monthly: 0,
        currency: "USD",
        sort_order: sortOrder,
        is_active: true,
        isNew: true,
      },
    ]);
  }

  async function removePlan(planId: string) {
    const plan = planes.find((item) => item.id === planId);
    if (!plan) return;
    if (!plan.isNew && !window.confirm(`¿Eliminar el plan "${plan.label}"?`)) return;

    if (!plan.isNew) {
      const supabase = createClient();
      await deletePlan(supabase, plan.id);
    }
    setPlanes((prev) => prev.filter((item) => item.id !== planId));
    setFeatures((prev) =>
      prev.map((feature) => ({
        ...feature,
        included_plan_ids: feature.included_plan_ids.filter((id) => id !== planId),
      })),
    );
  }

  function addGroup() {
    const sortOrder = groups.length > 0 ? Math.max(...groups.map((group) => group.sort_order)) + 1 : 1;
    setGroups((prev) => [
      ...prev,
      {
        id: tempId("new-group"),
        unit_code: unitCode,
        label: "Nueva categoría",
        sort_order: sortOrder,
        isNew: true,
      },
    ]);
  }

  async function removeGroup(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    if (!group.isNew && !window.confirm(`¿Eliminar la categoría "${group.label}" y sus funcionalidades?`)) {
      return;
    }

    if (!group.isNew) {
      const supabase = createClient();
      await deleteFeatureGroup(supabase, group.id);
    }
    setGroups((prev) => prev.filter((item) => item.id !== groupId));
    setFeatures((prev) => prev.filter((feature) => feature.group_id !== groupId));
  }

  function addFeature(groupId: string) {
    const groupFeatures = features.filter((feature) => feature.group_id === groupId);
    const sortOrder =
      groupFeatures.length > 0 ? Math.max(...groupFeatures.map((feature) => feature.sort_order)) + 1 : 1;
    setFeatures((prev) => [
      ...prev,
      {
        id: tempId("new-feature"),
        group_id: groupId,
        label: "",
        sort_order: sortOrder,
        included_plan_ids: activePlanes[0] ? [activePlanes[0].id] : [],
        isNew: true,
      },
    ]);
  }

  async function removeFeature(featureId: string) {
    const feature = features.find((item) => item.id === featureId);
    if (!feature) return;
    if (!feature.isNew && !window.confirm("¿Eliminar esta funcionalidad?")) return;

    if (!feature.isNew) {
      const supabase = createClient();
      await deleteFeature(supabase, feature.id);
    }
    setFeatures((prev) => prev.filter((item) => item.id !== featureId));
  }

  function toggleFeaturePlan(featureId: string, planId: string) {
    setFeatures((prev) =>
      prev.map((feature) => {
        if (feature.id !== featureId) return feature;
        const included = new Set(feature.included_plan_ids);
        if (included.has(planId)) included.delete(planId);
        else included.add(planId);
        return { ...feature, included_plan_ids: [...included] };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      await saveUnitPlanConfig(supabase, unitCode, planes, groups, features);
      setNotice("Configuración guardada.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  const sortedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <Topbar breadcrumb="Nodo Core · Ecosistema · Unidades" title={`${node.label} · Planes`} />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        <Link
          href="/panel/unidades"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--color-slate2)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={15} /> Volver a unidades
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--color-navy)" }}>{node.label}</h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--color-slate2)", maxWidth: 720 }}>
              {node.description}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-slate2)" }}>
              Definí precios y qué incluye cada plan. El pago anual usa 2 meses de descuento (10 cuotas por 12 meses).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: saving || loading ? "not-allowed" : "pointer",
              opacity: saving || loading ? 0.7 : 1,
              fontFamily: "var(--font-sans)",
              flexShrink: 0,
            }}
          >
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--color-slate2)", fontSize: 14 }}>Cargando configuración...</p>
        ) : (
          <>
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-navy)" }}>Planes y precios</h3>
                <button
                  type="button"
                  onClick={addPlan}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    color: "var(--color-brand)",
                    border: "1px solid var(--color-brand)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <Plus size={14} /> Agregar plan
                </button>
              </div>

              <div style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 10, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead>
                    <tr>
                      {["Código", "Nombre", "Mensual (USD)", "Anual / mes", "Orden", "Activo", ""].map((col) => (
                        <th key={col || "actions"} style={thStyle}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planes.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ ...tdStyle, color: "var(--color-slate2)" }}>
                          Todavía no hay planes. Agregá uno para empezar.
                        </td>
                      </tr>
                    ) : (
                      [...planes]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((plan) => (
                          <tr key={plan.id}>
                            <td style={tdStyle}>
                              <input
                                value={plan.code}
                                onChange={(e) => updatePlan(plan.id, { code: e.target.value })}
                                style={inputStyle}
                                placeholder="starter"
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                value={plan.label}
                                onChange={(e) => updatePlan(plan.id, { label: e.target.value })}
                                style={inputStyle}
                                placeholder="Starter"
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={plan.price_monthly}
                                onChange={(e) =>
                                  updatePlan(plan.id, { price_monthly: Number(e.target.value) })
                                }
                                style={inputStyle}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={plan.price_annual_monthly}
                                onChange={(e) =>
                                  updatePlan(plan.id, { price_annual_monthly: Number(e.target.value) })
                                }
                                style={inputStyle}
                              />
                            </td>
                            <td style={{ ...tdStyle, width: 80 }}>
                              <input
                                type="number"
                                value={plan.sort_order}
                                onChange={(e) => updatePlan(plan.id, { sort_order: Number(e.target.value) })}
                                style={inputStyle}
                              />
                            </td>
                            <td style={{ ...tdStyle, width: 70, textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={plan.is_active}
                                onChange={(e) => updatePlan(plan.id, { is_active: e.target.checked })}
                              />
                            </td>
                            <td style={{ ...tdStyle, width: 48 }}>
                              <button
                                type="button"
                                onClick={() => void removePlan(plan.id)}
                                aria-label="Eliminar plan"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#C0392B",
                                  cursor: "pointer",
                                  display: "flex",
                                  padding: 4,
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-navy)" }}>
                    Funcionalidades por plan
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--color-slate2)" }}>
                    Marcá qué incluye cada plan. Las columnas siguen el orden de los planes activos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addGroup}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    color: "var(--color-brand)",
                    border: "1px solid var(--color-brand)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <Plus size={14} /> Agregar categoría
                </button>
              </div>

              {activePlanes.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--color-slate2)" }}>
                  Creá al menos un plan activo para armar la matriz de funcionalidades.
                </p>
              ) : sortedGroups.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--color-slate2)" }}>
                  Agregá una categoría (ej. Propiedades, Caja) y luego sus funcionalidades.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {sortedGroups.map((group) => {
                    const groupFeatures = features
                      .filter((feature) => feature.group_id === group.id)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <div
                        key={group.id}
                        style={{
                          background: "white",
                          border: "1px solid var(--color-mist)",
                          borderRadius: 10,
                          overflow: "auto",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "12px 16px",
                            borderBottom: "1px solid var(--color-mist)",
                            background: "var(--color-paper)",
                          }}
                        >
                          <input
                            value={group.label}
                            onChange={(e) =>
                              setGroups((prev) =>
                                prev.map((item) =>
                                  item.id === group.id ? { ...item, label: e.target.value } : item,
                                ),
                              )
                            }
                            style={{ ...inputStyle, maxWidth: 320, fontWeight: 700 }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => addFeature(group.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: "white",
                                color: "var(--color-brand)",
                                border: "1px solid var(--color-brand)",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              <Plus size={13} /> Funcionalidad
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeGroup(group.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: "white",
                                color: "#C0392B",
                                border: "1px solid #F5C6C2",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, minWidth: 280 }}>Funcionalidad</th>
                              {activePlanes.map((plan, index) => (
                                <th
                                  key={plan.id}
                                  style={{
                                    ...thStyle,
                                    textAlign: "center",
                                    color: "white",
                                    background: PLAN_HEADER_COLORS[index % PLAN_HEADER_COLORS.length],
                                  }}
                                >
                                  {plan.label || plan.code}
                                </th>
                              ))}
                              <th style={{ ...thStyle, width: 48 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {groupFeatures.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={activePlanes.length + 2}
                                  style={{ ...tdStyle, color: "var(--color-slate2)" }}
                                >
                                  Sin funcionalidades en esta categoría.
                                </td>
                              </tr>
                            ) : (
                              groupFeatures.map((feature) => (
                                <tr key={feature.id}>
                                  <td style={tdStyle}>
                                    <input
                                      value={feature.label}
                                      onChange={(e) =>
                                        setFeatures((prev) =>
                                          prev.map((item) =>
                                            item.id === feature.id
                                              ? { ...item, label: e.target.value }
                                              : item,
                                          ),
                                        )
                                      }
                                      style={inputStyle}
                                      placeholder="Descripción de la funcionalidad"
                                    />
                                  </td>
                                  {activePlanes.map((plan) => (
                                    <td key={plan.id} style={{ ...tdStyle, textAlign: "center" }}>
                                      <input
                                        type="checkbox"
                                        checked={feature.included_plan_ids.includes(plan.id)}
                                        onChange={() => toggleFeaturePlan(feature.id, plan.id)}
                                        style={{ width: 16, height: 16, accentColor: "var(--color-brand)" }}
                                      />
                                    </td>
                                  ))}
                                  <td style={tdStyle}>
                                    <button
                                      type="button"
                                      onClick={() => void removeFeature(feature.id)}
                                      aria-label="Eliminar funcionalidad"
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#C0392B",
                                        cursor: "pointer",
                                        display: "flex",
                                        padding: 4,
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {notice && (
          <p style={{ marginTop: 16, fontSize: 13, color: "#1F8A5B", fontWeight: 600 }}>{notice}</p>
        )}
        {error && <p style={{ marginTop: 16, fontSize: 13, color: "#C0392B" }}>{error}</p>}
      </div>
    </>
  );
}
