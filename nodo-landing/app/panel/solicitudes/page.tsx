"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, FileImage, CreditCard } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { NODES } from "@/lib/nodes";

type VerificationDoc = {
  id: string;
  client_unit_id: string;
  doc_type: string;
  file_name: string | null;
  signed_url: string | null;
};

type OnboardingProfile = {
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  plan_choice: string | null;
  demo_days: number | null;
  document_number: string | null;
  gender: string | null;
  card_holder: string | null;
  card_last_four: string | null;
  card_expiry: string | null;
};

type IdentityCheck = {
  client_unit_id: string;
  status: string;
  outcome_code: string;
  face_match_score: number | null;
  provider: string;
  message: string | null;
  created_at: string;
};

type Solicitud = {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  status: string;
  created_at: string;
  docs_verified_at: string | null;
  admin_notes: string | null;
  client: { name: string; email: string | null; phone: string | null } | null;
  profile: OnboardingProfile | null;
  docs: VerificationDoc[];
  identityCheck: IdentityCheck | null;
};

const DOC_LABELS: Record<string, string> = {
  id_photo: "Documento de identidad",
  id_holding_selfie: "Selfie con DNI",
  selfie: "Selfie (verificación)",
  credit_card: "Foto de tarjeta",
  debit_card: "Tarjeta de débito",
  payment_proof: "Comprobante de pago",
  other: "Otro documento",
};

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadSolicitudes();
  }, []);

  async function loadSolicitudes() {
    const supabase = createClient();
    const [{ data: units }, { data: clients }, { data: profiles }, { data: identityChecks }] =
      await Promise.all([
      supabase
        .from("client_units")
        .select("id, client_id, unit_code, plan, status, created_at, docs_verified_at, admin_notes")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, email, phone"),
      supabase
        .from("onboarding_profiles")
        .select(
          "client_unit_id, first_name, last_name, address, city, province, phone, plan_choice, demo_days, document_number, gender, card_holder, card_last_four, card_expiry",
        ),
      supabase
        .from("identity_verification_checks")
        .select("client_unit_id, status, outcome_code, face_match_score, provider, message, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const unitIds = (units ?? []).map((u) => u.id);
    let docsByUnit: Record<string, VerificationDoc[]> = {};

    if (unitIds.length > 0) {
      const res = await fetch(
        `/api/admin/registration-docs?client_unit_ids=${unitIds.join(",")}`,
      );
      if (res.ok) {
        const json = await res.json();
        docsByUnit = json.by_unit ?? {};
      }
    }

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.client_unit_id, p]));
    const identityMap = new Map<string, IdentityCheck>();
    for (const check of identityChecks ?? []) {
      if (!identityMap.has(check.client_unit_id)) {
        identityMap.set(check.client_unit_id, check as IdentityCheck);
      }
    }

    const rows: Solicitud[] = (units ?? []).map((u) => ({
      ...u,
      client: clientMap.get(u.client_id) ?? null,
      profile: profileMap.get(u.id) ?? null,
      docs: docsByUnit[u.id] ?? [],
      identityCheck: identityMap.get(u.id) ?? null,
    }));
    setSolicitudes(rows);
    setLoading(false);
  }

  async function handleEnable(unitId: string) {
    setActionId(unitId);
    const res = await fetch("/api/admin/enable-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_unit_id: unitId,
        admin_notes: notes[unitId] ?? "",
        docs_verified: true,
        action: "enable",
      }),
    });
    setActionId(null);
    if (res.ok) {
      await loadSolicitudes();
    } else {
      const json = await res.json();
      alert(json.error ?? "Error al habilitar.");
    }
  }

  function nodeLabel(code: string) {
    return NODES.find((n) => n.code === code)?.label ?? code;
  }

  function planLabel(profile: OnboardingProfile | null, unitPlan: string | null) {
    if (profile?.plan_choice === "demo") {
      return `Demo ${profile.demo_days ?? 14} días`;
    }
    if (profile?.plan_choice) {
      return profile.plan_choice === "pro" ? "Plan Pro" : "Plan Starter";
    }
    return unitPlan ?? "—";
  }

  return (
    <>
      <Topbar title="Solicitudes pendientes" breadcrumb="Panel / Solicitudes" />
      <div className="panel-scroll" style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        <p style={{ color: "var(--color-slate2)", fontSize: 14, maxWidth: 720, marginBottom: 24 }}>
          Revisá documentación, datos de contacto y tarjeta. Al habilitar, el usuario recibe el
          correo para configurar su contraseña en el primer acceso.
        </p>

        {loading ? (
          <p style={{ color: "var(--color-slate2)" }}>Cargando…</p>
        ) : solicitudes.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", borderRadius: 14, background: "var(--color-mist)" }}>
            <CheckCircle size={32} style={{ color: "var(--color-slate2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--color-slate2)" }}>No hay solicitudes pendientes de revisión.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {solicitudes.map((s) => (
              <article
                key={s.id}
                style={{ border: "1px solid var(--color-mist)", borderRadius: 14, padding: 20, background: "#fff" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{s.client?.name}</h3>
                    <p style={{ fontSize: 13, color: "var(--color-slate2)", margin: "4px 0" }}>
                      {s.client?.email}
                      {s.profile?.phone || s.client?.phone ? ` · ${s.profile?.phone ?? s.client?.phone}` : ""}
                    </p>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ background: "#FCE9D8", color: "#B5630C", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        {nodeLabel(s.unit_code)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
                        {planLabel(s.profile, s.plan)}
                      </span>
                      {s.identityCheck && (
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              s.identityCheck.status === "approved"
                                ? "#D1FAE5"
                                : s.identityCheck.status === "review"
                                  ? "#FEF3C7"
                                  : "#FEE2E2",
                            color:
                              s.identityCheck.status === "approved"
                                ? "#065F46"
                                : s.identityCheck.status === "review"
                                  ? "#92400E"
                                  : "#991B1B",
                          }}
                        >
                          Identidad:{" "}
                          {s.identityCheck.status === "approved"
                            ? "Verificado"
                            : s.identityCheck.status === "review"
                              ? "Revisión manual"
                              : "No verificado"}
                          {s.identityCheck.face_match_score != null
                            ? ` (${Math.round(Number(s.identityCheck.face_match_score) * 100)}%)`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-slate2)", whiteSpace: "nowrap" }}>
                    <Clock size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                    {new Date(s.created_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {s.profile && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 10,
                      background: "var(--color-paper)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 10,
                      fontSize: 13,
                    }}
                  >
                    {(s.profile.address || s.profile.city) && (
                      <div>
                        <span style={{ color: "var(--color-slate2)", fontSize: 11, fontWeight: 600 }}>Domicilio</span>
                        <p style={{ margin: "2px 0 0" }}>
                          {s.profile.address}
                          {s.profile.city ? `, ${s.profile.city}` : ""}
                          {s.profile.province ? ` (${s.profile.province})` : ""}
                        </p>
                      </div>
                    )}
                    {s.profile.document_number && (
                      <div>
                        <span style={{ color: "var(--color-slate2)", fontSize: 11, fontWeight: 600 }}>DNI</span>
                        <p style={{ margin: "2px 0 0", fontFamily: "monospace" }}>
                          {s.profile.document_number}
                          {s.profile.gender ? ` · ${s.profile.gender}` : ""}
                        </p>
                      </div>
                    )}
                    {s.profile.card_holder && (
                      <div>
                        <span style={{ color: "var(--color-slate2)", fontSize: 11, fontWeight: 600 }}>Tarjeta</span>
                        <p style={{ margin: "2px 0 0" }}>
                          {s.profile.card_holder}
                          <br />
                          <span style={{ fontFamily: "monospace" }}>···· {s.profile.card_last_four}</span>
                          {s.profile.card_expiry ? ` · Vence ${s.profile.card_expiry}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {s.docs.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-slate2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Documentación enviada
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {s.docs.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            border: "1px solid var(--color-mist)",
                            borderRadius: 10,
                            padding: 10,
                            width: 160,
                            background: "#fff",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            {doc.doc_type === "credit_card" ? (
                              <CreditCard size={14} color="var(--color-slate2)" />
                            ) : (
                              <FileImage size={14} color="var(--color-slate2)" />
                            )}
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-navy)" }}>
                              {DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                            </span>
                          </div>
                          {doc.signed_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(doc.signed_url!)}
                              style={{
                                display: "block",
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={doc.signed_url}
                                alt={DOC_LABELS[doc.doc_type] ?? "Documento"}
                                style={{
                                  width: "100%",
                                  height: 100,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                  background: "var(--color-mist)",
                                }}
                              />
                            </button>
                          ) : (
                            <p style={{ fontSize: 11, color: "var(--color-slate2)" }}>Sin vista previa</p>
                          )}
                          {doc.file_name && (
                            <p style={{ fontSize: 10, color: "var(--color-slate2)", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {doc.file_name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  value={notes[s.id] ?? s.admin_notes ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  rows={2}
                  placeholder="Notas de verificación…"
                  style={{ width: "100%", marginTop: 16, padding: 10, borderRadius: 8, border: "1px solid var(--color-mist)", fontSize: 13, boxSizing: "border-box" }}
                />

                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    disabled={actionId === s.id}
                    onClick={() => handleEnable(s.id)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1F8A5B",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: actionId === s.id ? "not-allowed" : "pointer",
                      opacity: actionId === s.id ? 0.7 : 1,
                    }}
                  >
                    {actionId === s.id ? "Habilitando…" : "Habilitar acceso"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>Pendiente de revisión</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18,30,47,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              background: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista ampliada"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain" }}
          />
        </div>
      )}
    </>
  );
}
