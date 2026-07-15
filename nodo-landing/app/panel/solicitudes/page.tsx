"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, FileImage, CreditCard, Trash2, MailCheck, AlertCircle, ChevronDown } from "lucide-react";
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

type ClientUnitRow = {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  status: string;
  created_at: string;
  docs_verified_at: string | null;
  admin_notes: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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
  id_front: "DNI Frente",
  id_back: "DNI Dorso",
  id_holding_selfie: "Selfie con DNI",
  selfie: "Selfie (verificación)",
  credit_card: "Foto de tarjeta",
  debit_card: "Tarjeta de débito",
  payment_proof: "Comprobante de pago",
  other: "Otro documento",
};

type ClinicRegistration = {
  id: string;
  email: string;
  role: "medico" | "paciente";
  verified_at: string | null;
  onboarding_token: string | null;
  expires_at: string;
  created_at: string;
  stage: "pending_email" | "expired" | "pending_onboarding" | "pending_activation";
};

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [clinicRegs, setClinicRegs] = useState<ClinicRegistration[]>([]);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicActionId, setClinicActionId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<string | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    loadSolicitudes();
    loadClinicRegistrations();
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

    const unitIds = (units ?? []).map((u: ClientUnitRow) => u.id);
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

    const clientMap = new Map((clients ?? []).map((c: ClientRow) => [c.id, c]));
    const profileMap = new Map(
      (profiles ?? []).map((p: OnboardingProfile & { client_unit_id: string }) => [p.client_unit_id, p]),
    );
    const identityMap = new Map<string, IdentityCheck>();
    for (const check of identityChecks ?? []) {
      if (!identityMap.has(check.client_unit_id)) {
        identityMap.set(check.client_unit_id, check as IdentityCheck);
      }
    }

    const rows: Solicitud[] = (units ?? []).map((u: ClientUnitRow) => ({
      ...u,
      client: clientMap.get(u.client_id) ?? null,
      profile: profileMap.get(u.id) ?? null,
      docs: docsByUnit[u.id] ?? [],
      identityCheck: identityMap.get(u.id) ?? null,
    }));
    setSolicitudes(rows);
    setLoading(false);
  }

  async function loadClinicRegistrations() {
    setClinicLoading(true);
    const res = await fetch("/api/admin/clinic-registrations");
    if (res.ok) {
      const json = await res.json();
      setClinicRegs(json.registrations ?? []);
    }
    setClinicLoading(false);
  }

  async function handleClinicEnable(id: string) {
    setClinicActionId(id);
    const res = await fetch("/api/admin/clinic-registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setClinicActionId(null);
    if (res.ok) {
      await loadClinicRegistrations();
    } else {
      const json = await res.json();
      alert(json.error ?? "Error al habilitar.");
    }
  }

  async function handleClinicDelete(id: string) {
    setClinicActionId(id);
    const res = await fetch("/api/admin/clinic-registrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setClinicActionId(null);
    setDeleteConfirmId(null);
    if (res.ok) {
      await loadClinicRegistrations();
    } else {
      const json = await res.json();
      alert(json.error ?? "Error al eliminar.");
    }
  }

  async function handleDeleteUnit(unitId: string) {
    setDeletingUnitId(unitId);
    const res = await fetch("/api/admin/pending-solicitud", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_unit_id: unitId }),
    });
    setDeletingUnitId(null);
    setDeleteUnitId(null);
    if (res.ok) {
      await loadSolicitudes();
    } else {
      const json = await res.json();
      alert(json.error ?? "Error al eliminar la solicitud.");
    }
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
      return profile.demo_days ? `Demo · ${profile.demo_days} días` : "Plan Demo";
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

        {/* ── Global loader ──────────────────────────────────────────── */}
        {(clinicLoading || loading) && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "var(--color-slate2)", fontSize: 14 }}>Cargando solicitudes…</p>
          </div>
        )}

        {!clinicLoading && !loading && clinicRegs.length === 0 && solicitudes.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", borderRadius: 14, background: "var(--color-mist)" }}>
            <p style={{ color: "var(--color-slate2)", fontSize: 13, margin: 0 }}>Sin solicitudes pendientes.</p>
          </div>
        )}

        {/* ── Nodo Clínica registrations ─────────────────────────────── */}
        {!clinicLoading && clinicRegs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {clinicRegs.map((r) => {
              const stageLabel =
                r.stage === "pending_email"
                  ? "Estadío 1 — Email enviado"
                  : r.stage === "expired"
                    ? "Estadío 1 — Link expirado"
                    : r.stage === "pending_activation"
                      ? "Estadío 3 — Onboarding completo"
                      : "Estadío 2 — En onboarding";

              const stageBg =
                r.stage === "pending_email"
                  ? "#DBEAFE"
                  : r.stage === "expired"
                    ? "#FEE2E2"
                    : r.stage === "pending_activation"
                      ? "#FEF3C7"
                      : "#D1FAE5";

              const stageColor =
                r.stage === "pending_email"
                  ? "#1D4ED8"
                  : r.stage === "expired"
                    ? "#991B1B"
                    : r.stage === "pending_activation"
                      ? "#92400E"
                      : "#065F46";

              const StageIcon =
                r.stage === "pending_email"
                  ? Clock
                  : r.stage === "expired"
                    ? AlertCircle
                    : r.stage === "pending_activation"
                      ? CheckCircle
                      : MailCheck;

              return (
                <article
                  key={r.id}
                  style={{
                    border: "1px solid var(--color-mist)",
                    borderRadius: 12,
                    padding: "14px 18px",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{r.email}</p>
                      <p style={{ fontSize: 12, color: "var(--color-slate2)", margin: "3px 0 0" }}>
                        {r.role === "medico" ? "Médico" : "Paciente"} ·{" "}
                        {new Date(r.created_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {r.stage !== "pending_onboarding" && (
                          <> · vence {new Date(r.expires_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</>
                        )}
                      </p>
                    </div>
                    <span style={{ background: "#E0F2F1", color: "#0D9488", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                      Nodo Clínica
                    </span>
                    <span
                      style={{
                        background: stageBg,
                        color: stageColor,
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <StageIcon size={11} />
                      {stageLabel}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {r.stage === "pending_activation" && (
                      <button
                        type="button"
                        disabled={clinicActionId === r.id}
                        onClick={() => handleClinicEnable(r.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: "#1F8A5B",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: clinicActionId === r.id ? "not-allowed" : "pointer",
                          opacity: clinicActionId === r.id ? 0.7 : 1,
                        }}
                      >
                        <CheckCircle size={13} />
                        {clinicActionId === r.id ? "Habilitando…" : "Habilitar"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(r.id)}
                      title="Eliminar solicitud (permite re-registro)"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid #FCA5A5",
                        background: "transparent",
                        color: "#DC2626",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Other nodo registrations ────────────────────────────────── */}
        {!loading && solicitudes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {solicitudes.map((s) => {
              const isExpanded = expandedIds.has(s.id);
              return (
                <article
                  key={s.id}
                  style={{ border: "1px solid var(--color-mist)", borderRadius: 14, background: "#fff", overflow: "hidden" }}
                >
                  {/* ── Accordion header ─────────────────────────────── */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(s.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "14px 18px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-navy)" }}>{s.client?.name}</p>
                        <p style={{ fontSize: 12, color: "var(--color-slate2)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.client?.email}
                          {s.profile?.phone || s.client?.phone ? ` · ${s.profile?.phone ?? s.client?.phone}` : ""}
                        </p>
                      </div>
                      <span style={{ background: "#FCE9D8", color: "#B5630C", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {nodeLabel(s.unit_code)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--color-slate2)", whiteSpace: "nowrap" }}>
                        {s.unit_code}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "var(--color-slate2)", whiteSpace: "nowrap" }}>
                        <Clock size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                        {new Date(s.created_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <ChevronDown
                        size={16}
                        color="var(--color-slate2)"
                        style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                      />
                    </div>
                  </button>

                  {/* ── Accordion body ───────────────────────────────── */}
                  {isExpanded && (
                    <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--color-mist)" }}>
                      {/* Profile details */}
                      {s.profile && (
                        <div
                          style={{
                            marginTop: 14,
                            padding: 14,
                            borderRadius: 10,
                            background: "var(--color-paper)",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: 10,
                            fontSize: 13,
                          }}
                        >
                          <div>
                            <span style={{ color: "var(--color-slate2)", fontSize: 11, fontWeight: 600 }}>Plan</span>
                            <p style={{ margin: "2px 0 0" }}>{planLabel(s.profile, s.plan)}</p>
                          </div>
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
                          {s.identityCheck && (
                            <div>
                              <span style={{ color: "var(--color-slate2)", fontSize: 11, fontWeight: 600 }}>Identidad</span>
                              <p style={{ margin: "2px 0 0" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
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
                                  {s.identityCheck.status === "approved"
                                    ? "Verificado"
                                    : s.identityCheck.status === "review"
                                      ? "Revisión manual"
                                      : "No verificado"}
                                  {s.identityCheck.face_match_score != null
                                    ? ` (${Math.round(Number(s.identityCheck.face_match_score) * 100)}%)`
                                    : ""}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Docs */}
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

                      {/* Notes + actions */}
                      <textarea
                        value={notes[s.id] ?? s.admin_notes ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        rows={2}
                        placeholder="Notas de verificación…"
                        style={{ width: "100%", marginTop: 16, padding: 10, borderRadius: 8, border: "1px solid var(--color-mist)", fontSize: 13, boxSizing: "border-box" }}
                      />

                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
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
                        <button
                          type="button"
                          disabled={deletingUnitId === s.id}
                          onClick={() => setDeleteUnitId(s.id)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "1px solid #FECACA",
                            background: "#FFF5F5",
                            color: "#DC2626",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: deletingUnitId === s.id ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: deletingUnitId === s.id ? 0.7 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                          Eliminar solicitud
                        </button>
                        <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>Pendiente de revisión</span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
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

      {/* ── Delete solicitud (client_unit) confirmation ─────────────── */}
      {deleteUnitId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteUnitId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18,30,47,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 32px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 8px 30px rgba(0,0,0,.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 8, display: "flex" }}>
                <Trash2 size={18} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--color-navy)" }}>
                Eliminar solicitud pendiente
              </h3>
            </div>
            <p style={{ fontSize: 14, color: "var(--color-slate2)", lineHeight: 1.5, margin: "0 0 24px" }}>
              Se eliminará la solicitud y los documentos asociados. El usuario podrá volver a registrarse con el mismo email.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteUnitId(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid var(--color-mist)",
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--color-navy)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingUnitId === deleteUnitId}
                onClick={() => handleDeleteUnit(deleteUnitId)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: deletingUnitId === deleteUnitId ? "not-allowed" : "pointer",
                  opacity: deletingUnitId === deleteUnitId ? 0.7 : 1,
                }}
              >
                {deletingUnitId === deleteUnitId ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ───────────────────────────────── */}
      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteConfirmId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18,30,47,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 32px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 8px 30px rgba(0,0,0,.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#FEE2E2", borderRadius: 10, padding: 8, display: "flex" }}>
                <Trash2 size={18} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--color-navy)" }}>
                Eliminar solicitud
              </h3>
            </div>
            <p style={{ fontSize: 14, color: "var(--color-slate2)", lineHeight: 1.5, margin: "0 0 24px" }}>
              ¿Estás seguro? El usuario podrá volver a registrarse con el mismo email.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid var(--color-mist)",
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--color-navy)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={clinicActionId === deleteConfirmId}
                onClick={() => handleClinicDelete(deleteConfirmId)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: clinicActionId === deleteConfirmId ? "not-allowed" : "pointer",
                  opacity: clinicActionId === deleteConfirmId ? 0.7 : 1,
                }}
              >
                {clinicActionId === deleteConfirmId ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
