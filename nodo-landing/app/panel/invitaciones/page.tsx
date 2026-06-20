"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/panel/Topbar";
import { Mail, CheckCircle, XCircle, Clock, Building2 } from "lucide-react";

type Invitation = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  created_at: string;
  org_name: string;
  inviter_name: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  agent: "Empleado",
  owner: "Propietario",
  tenant: "Inquilino",
};

function formatExpiry(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function InvitacionesPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Same-origin call — carries landing session cookies automatically.
      // The server route uses service role to query inmo bypassing RLS.
      const res = await fetch("/api/internal/my-invitations");

      if (!res.ok) {
        setInvitations([]);
        setLoading(false);
        return;
      }

      const data: { invitations: Invitation[] } = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  async function handleAction(invitation: Invitation, action: "accept" | "reject") {
    setProcessingId(invitation.id);
    setNotice(null);
    setError(null);

    try {
      const res = await fetch("/api/internal/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitation.token, action }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "No se pudo procesar la invitación.");
        return;
      }

      if (action === "accept") {
        setNotice(
          `Invitación aceptada. Ya sos parte del equipo. Ingresá a NODO | Inmo para comenzar.`,
        );
      } else {
        setNotice("Invitación rechazada.");
      }

      // Remove processed invitation from local list.
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la invitación.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Panel"
        title="Invitaciones pendientes"
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {notice && (
          <div
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              background: "#E1F0E8",
              border: "1px solid #A3D4BA",
              borderRadius: 8,
              fontSize: 14,
              color: "#1F5C3A",
              fontWeight: 500,
            }}
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              fontSize: 14,
              color: "#991B1B",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--color-slate2)",
              fontSize: 14,
            }}
          >
            Cargando invitaciones...
          </div>
        ) : invitations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 60,
              gap: 12,
              color: "var(--color-slate2)",
            }}
          >
            <Mail size={40} strokeWidth={1.5} style={{ opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              No tenés invitaciones pendientes
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              Cuando alguien te invite a un equipo, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {invitations.map((inv) => {
              const processing = processingId === inv.id;

              return (
                <div
                  key={inv.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--color-mist)",
                    borderRadius: 12,
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: "var(--color-paper)",
                      border: "1px solid var(--color-mist)",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={22} color="var(--color-navy)" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--color-navy)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {inv.org_name}
                    </p>
                    {inv.inviter_name !== "—" && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12.5,
                          color: "var(--color-slate2)",
                        }}
                      >
                        Invitado por <strong>{inv.inviter_name}</strong>
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: "var(--color-mist-200)",
                          color: "var(--color-navy)",
                          borderRadius: 999,
                          padding: "2px 10px",
                        }}
                      >
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          color: "var(--color-slate2)",
                        }}
                      >
                        <Clock size={12} />
                        {`Expira el ${formatExpiry(inv.expires_at)}`}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleAction(inv, "accept")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#1F8A5B",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: processing ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-sans)",
                        opacity: processing ? 0.65 : 1,
                      }}
                    >
                      <CheckCircle size={15} />
                      {processing ? "Procesando..." : "Aceptar"}
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleAction(inv, "reject")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        color: "#C0392B",
                        border: "1px solid #F5C6C2",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: processing ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-sans)",
                        opacity: processing ? 0.65 : 1,
                      }}
                    >
                      <XCircle size={15} />
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
