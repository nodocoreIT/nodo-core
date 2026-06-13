"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { getNodoPlanBySlug, STATUS_LABEL, STATUS_COLOR, type PlanTier } from "@/lib/nodo-plans";

const PLAN_ORDER: PlanTier[] = ["starter", "pro"];

const PLAN_STYLE: Record<PlanTier, { bg: string; accent: string; label: string }> = {
  starter: { bg: "var(--color-brand)", accent: "rgba(255,255,255,.15)", label: "Starter" },
  pro: { bg: "var(--color-navy-900)", accent: "rgba(255,255,255,.08)", label: "Pro" },
};

function PlanCard({
  tier,
  pricing,
}: {
  tier: PlanTier;
  pricing: { monthly: number; annual: number; currency: string };
}) {
  const style = PLAN_STYLE[tier];
  return (
    <div
      style={{
        background: style.bg,
        borderRadius: 16,
        padding: "28px 24px",
        flex: 1,
        minWidth: 220,
        color: "white",
      }}
    >
      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>
        Pago mensual
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {style.label}
      </p>
      <p style={{ margin: "0 0 2px", fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
        {pricing.currency} {pricing.monthly}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.7 }}>
        Pago anual: <strong>{pricing.currency} {pricing.annual}/mes</strong>
      </p>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.5 }}>
        ({pricing.currency} {pricing.annual * 12}/año)
      </p>
    </div>
  );
}

export default function NodoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const nodo = getNodoPlanBySlug(slug);

  if (!nodo || nodo.status !== "development") notFound();

  const statusStyle = STATUS_COLOR[nodo.status];

  return (
    <>
      <Topbar
        breadcrumb={`Nodo Core · Ecosistema · Unidades`}
        title={nodo.label}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {/* Back */}
        <Link
          href="/panel/unidades"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--color-slate2)",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={15} /> Volver a unidades
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>
            {nodo.label}
          </h2>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              padding: "3px 10px",
              background: statusStyle.bg,
              color: statusStyle.text,
            }}
          >
            {STATUS_LABEL[nodo.status]}
          </span>
        </div>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "var(--color-slate2)" }}>
          {nodo.description}
        </p>

        {/* Plan pricing cards */}
        {nodo.plans && (
          <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
            {PLAN_ORDER.map((tier) => (
              <PlanCard key={tier} tier={tier} pricing={nodo.plans![tier]} />
            ))}
          </div>
        )}

        {/* Feature matrix */}
        {nodo.featureGroups && (
          <div>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>
              Funcionalidades por plan
            </h3>

            {/* Legend */}
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              {PLAN_ORDER.map((tier) => (
                <div key={tier} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: tier === "starter" ? "var(--color-brand)" : "var(--color-slate2)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--color-slate2)", fontWeight: 600 }}>
                    {PLAN_STYLE[tier].label}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={10} color="var(--color-slate2)" />
                <span style={{ fontSize: 12, color: "var(--color-slate2)", fontWeight: 600 }}>
                  Solo Pro (bloqueado en Starter)
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {nodo.featureGroups.map((group) => (
                <div
                  key={group.label}
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid rgba(255,255,255,.07)",
                      background: "rgba(255,255,255,.03)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                      {group.label}
                    </p>
                  </div>
                  <div>
                    {group.features.map((feature, i) => {
                      const isPro = feature.minPlan === "pro";
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 20px",
                            borderBottom: i < group.features.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
                          }}
                        >
                          {isPro ? (
                            <Lock
                              size={15}
                              style={{ flexShrink: 0, color: "var(--color-slate2)", opacity: 0.5 }}
                            />
                          ) : (
                            <Check
                              size={15}
                              style={{ flexShrink: 0, color: "var(--color-brand)" }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              color: isPro ? "var(--color-slate2)" : "var(--color-text)",
                              flex: 1,
                            }}
                          >
                            {feature.text}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 999,
                              padding: "2px 8px",
                              background: isPro
                                ? "rgba(255,255,255,.06)"
                                : "rgba(218,90,14,.15)",
                              color: isPro ? "var(--color-slate2)" : "var(--color-brand)",
                              flexShrink: 0,
                            }}
                          >
                            {isPro ? "Pro" : "Starter+"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
