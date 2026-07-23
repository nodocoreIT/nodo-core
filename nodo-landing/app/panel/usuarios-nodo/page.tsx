"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Topbar from "@/components/panel/Topbar";
import { FormSelect, SearchInput } from "@nodocore/shared-components";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  KeyRound,
  Loader2,
  Mail,
  Pause,
  Play,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";
import type { NodoUserAccessType, NodoUserRecord } from "@/lib/panel/nodo-users-list";
import type { UserActionPreview } from "@/lib/panel/nodo-user-lifecycle";

type SortKey = "user" | "nodo" | "tipo" | "estado" | "alta";
type SortDir = "asc" | "desc";

const ACCESS_TYPE_LABELS: Record<NodoUserAccessType, string> = {
  suscripcion: "Suscripción",
  registro_gratuito: "Registro gratuito",
  invitacion_equipo: "Invitación de equipo",
};

type NodePillTheme = { bg: string; color: string };

const NODE_PILL_COLORS: Record<string, NodePillTheme> = {
  autos: { bg: "#B62635", color: "#ffffff" },
  finanzas: { bg: "#05805C", color: "#ffffff" },
  ecommerce: { bg: "#DCD500", color: "#000000" },
  clinica: { bg: "#0D7C73", color: "#ffffff" },
  salud: { bg: "#ff0077", color: "#ffffff" },
  inmo: { bg: "#CA460D", color: "#ffffff" },
  legales: { bg: "#530403", color: "#ffffff" },
};

function normalizeUnitCodeForPill(unitCode: string): string {
  return unitCode.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getNodePillTheme(unitCode: string): NodePillTheme {
  const normalized = normalizeUnitCodeForPill(unitCode);
  return NODE_PILL_COLORS[normalized] ?? { bg: "var(--color-mist-200)", color: "var(--color-navy)" };
}

function NodePill({ unitCode, label }: { unitCode: string; label: string }) {
  const theme = getNodePillTheme(unitCode);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        background: theme.bg,
        color: theme.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  activo: { bg: "#E1F0E8", color: "#1F8A5B", label: "Activo" },
  pausado: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Pausado" },
  suspendido: { bg: "#FEE2E2", color: "#991B1B", label: "Suspendido" },
  pending_review: { bg: "#FCE9D8", color: "#B5630C", label: "Pendiente revisión" },
  pending_onboarding: { bg: "#E8EEF8", color: "#2A6FDB", label: "Onboarding pendiente" },
  onboarding: { bg: "#FCE9D8", color: "#B5630C", label: "Onboarding" },
  trial: { bg: "#E8EEF8", color: "#2A6FDB", label: "Trial" },
  expired: { bg: "#FEE2E2", color: "#991B1B", label: "Expirado" },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: "var(--color-mist)", color: "var(--color-slate2)", label: status };
}

function matchesEmailOrName(user: NodoUserRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (user.email.toLowerCase().includes(q)) return true;

  const name = (user.fullName ?? "").trim().toLowerCase();
  if (!name) return false;
  if (name.includes(q)) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => name.includes(token));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function UsuariosNodoPage() {
  const [users, setUsers] = useState<NodoUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNodo, setFilterNodo] = useState("all");
  const [filterAccess, setFilterAccess] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<NodoUserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("alta");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [impactModal, setImpactModal] = useState<{
    user: NodoUserRecord;
    action: "delete" | "revoke";
    preview: UserActionPreview | null;
    loading: boolean;
    confirmEmail: string;
    error: string | null;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/nodo-users");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar los usuarios.");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("Error de red al cargar usuarios.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const nodoOptions = useMemo(() => {
    const codes = [...new Set(users.map((u) => u.unitCode))].sort();
    return [{ value: "all", label: "Todos los nodos" }, ...codes.map((c) => ({ value: c, label: c }))];
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterNodo !== "all" && u.unitCode !== filterNodo) return false;
      if (filterAccess !== "all" && u.accessType !== filterAccess) return false;
      return matchesEmailOrName(u, searchTerm);
    });
  }, [users, filterNodo, filterAccess, searchTerm]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortKey) {
        case "user": {
          const an = (a.fullName ?? a.email).toLowerCase();
          const bn = (b.fullName ?? b.email).toLowerCase();
          return an.localeCompare(bn) * dir;
        }
        case "nodo":
          return a.unitLabel.localeCompare(b.unitLabel) * dir;
        case "tipo":
          return a.accessType.localeCompare(b.accessType) * dir;
        case "estado": {
          const as = a.authBanned ? "suspendido" : a.status;
          const bs = b.authBanned ? "suspendido" : b.status;
          return as.localeCompare(bs) * dir;
        }
        case "alta":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (ta - tb) * dir;
        }
      }
    });

    return list;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "alta" ? "desc" : "asc");
    }
  }

  async function openImpactModal(user: NodoUserRecord, action: "delete" | "revoke") {
    setImpactModal({
      user,
      action,
      preview: null,
      loading: true,
      confirmEmail: "",
      error: null,
    });

    try {
      const res = await fetch("/api/admin/nodo-users/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "delete" ? "preview_delete" : "preview_revoke",
          user,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImpactModal({
          user,
          action,
          preview: null,
          loading: false,
          confirmEmail: "",
          error: data.error ?? "No se pudo cargar el impacto.",
        });
        return;
      }
      setImpactModal({
        user,
        action,
        preview: data.preview,
        loading: false,
        confirmEmail: "",
        error: null,
      });
    } catch {
      setImpactModal({
        user,
        action,
        preview: null,
        loading: false,
        confirmEmail: "",
        error: "Error de red al cargar el impacto.",
      });
    }
  }

  async function confirmImpactAction() {
    if (!impactModal) return;
    const { user, action, confirmEmail } = impactModal;

    if (action === "delete" && confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setImpactModal({ ...impactModal, error: "Escribí el email exacto para confirmar." });
      return;
    }

    setImpactModal({ ...impactModal, loading: true, error: null });
    setProcessingId(user.id);

    try {
      const res = await fetch("/api/admin/nodo-users/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          user,
          confirm_email: action === "delete" ? confirmEmail.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImpactModal({ ...impactModal, loading: false, error: data.error ?? "No se pudo completar la acción." });
        return;
      }
      setImpactModal(null);
      setNotice(
        action === "delete"
          ? `Usuario ${user.email} eliminado de ${user.unitLabel}.`
          : `Acceso revocado para ${user.email}.`,
      );
      await loadUsers();
    } catch {
      setImpactModal({ ...impactModal, loading: false, error: "Error de red." });
    } finally {
      setProcessingId(null);
    }
  }

  async function runAction(user: NodoUserRecord, body: Record<string, unknown>, successMsg: string) {
    setProcessingId(user.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/nodo-users/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar la acción.");
        return;
      }
      setNotice(successMsg);
      await loadUsers();
    } catch {
      setError("Error de red al ejecutar la acción.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handlePause(user: NodoUserRecord) {
    if (user.clientUnitId) {
      await runAction(
        user,
        { action: "pause", client_unit_id: user.clientUnitId },
        `Acceso pausado para ${user.email}.`,
      );
      return;
    }
    if (user.authUserId) {
      await runAction(
        user,
        {
          action: "suspend_auth",
          unit_code: user.unitCode,
          auth_user_id: user.authUserId,
          email: user.email,
          portal_role: user.role === "medico" ? "medico" : user.role === "paciente" ? "paciente" : "both",
          clinic_row_id: user.id.startsWith("clinic-") ? user.id : undefined,
        },
        `Usuario suspendido en ${user.unitLabel}.`,
      );
    }
  }

  async function handleReactivate(user: NodoUserRecord) {
    if (user.clientUnitId) {
      await runAction(
        user,
        { action: "reactivate", client_unit_id: user.clientUnitId },
        `Acceso reactivado para ${user.email}.`,
      );
      return;
    }
    if (user.authUserId) {
      await runAction(
        user,
        {
          action: "reactivate_auth",
          unit_code: user.unitCode,
          auth_user_id: user.authUserId,
          email: user.email,
          portal_role: user.role === "medico" ? "medico" : user.role === "paciente" ? "paciente" : "both",
          clinic_row_id: user.id.startsWith("clinic-") ? user.id : undefined,
        },
        `Usuario reactivado en ${user.unitLabel}.`,
      );
    }
  }

  async function handleSendReset(user: NodoUserRecord) {
    await runAction(
      user,
      { action: "send_password_reset", unit_code: user.unitCode, email: user.email },
      `Email de recuperación enviado a ${user.email}.`,
    );
  }

  async function handleRevoke(user: NodoUserRecord) {
    await openImpactModal(user, "revoke");
  }

  async function handleDelete(user: NodoUserRecord) {
    await openImpactModal(user, "delete");
  }

  async function handleSavePassword() {
    if (!passwordUser || newPassword.trim().length < 8) return;
    setProcessingId(passwordUser.id);
    setNotice(null);
    setError(null);

    try {
      const body =
        passwordUser.clientId
          ? {
              action: "set_password",
              client_id: passwordUser.clientId,
              unit_code: passwordUser.unitCode,
              password: newPassword.trim(),
            }
          : {
              action: "set_password_direct",
              unit_code: passwordUser.unitCode,
              auth_user_id: passwordUser.authUserId,
              password: newPassword.trim(),
            };

      const res = await fetch("/api/admin/nodo-users/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña.");
        return;
      }
      setNotice(`Contraseña actualizada para ${passwordUser.email}.`);
      setPasswordUser(null);
      setNewPassword("");
    } catch {
      setError("Error de red al cambiar la contraseña.");
    } finally {
      setProcessingId(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--color-mist)",
    borderRadius: 12,
    overflow: "hidden",
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--color-slate2)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--color-mist)",
    background: "var(--color-paper)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: 13.5,
    color: "var(--color-ink)",
    borderBottom: "1px solid var(--color-mist)",
    verticalAlign: "middle",
  };

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Panel"
        title="Usuarios de Nodo"
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--color-slate2)", maxWidth: 720 }}>
          Usuarios finales de cada nodo: clientes con suscripción, pacientes o médicos registrados sin plan,
          e invitados a equipos Pro. Desde acá podés pausar, reactivar, cambiar contraseña o revocar acceso.
        </p>

        {notice && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "#E1F0E8", border: "1px solid #A3D4BA", borderRadius: 8, fontSize: 14, color: "#1F5C3A" }}>
            {notice}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 14, color: "#991B1B" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", minWidth: 220, maxWidth: 420 }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por email o nombre…"
              className="w-full"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <FormSelect
              value={filterNodo}
              onChange={setFilterNodo}
              options={nodoOptions}
              aria-label="Filtrar por nodo"
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <FormSelect
              value={filterAccess}
              onChange={setFilterAccess}
              options={[
                { value: "all", label: "Todos los tipos de acceso" },
                { value: "suscripcion", label: "Suscripción" },
                { value: "registro_gratuito", label: "Registro gratuito" },
                { value: "invitacion_equipo", label: "Invitación de equipo" },
              ]}
              aria-label="Filtrar por tipo de acceso"
            />
          </div>
          <p style={{ margin: 0, alignSelf: "center", fontSize: 13, color: "var(--color-slate2)" }}>
            {filtered.length} {filtered.length === 1 ? "usuario" : "usuarios"}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-slate2)" }}>
            <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
            Cargando usuarios...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "var(--color-slate2)" }}>
            <UserRound size={40} strokeWidth={1.5} style={{ opacity: 0.4, margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>No hay usuarios para mostrar</p>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <SortableTh label="Usuario" sortKey="user" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={thStyle} />
                    <SortableTh label="Nodo" sortKey="nodo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={thStyle} />
                    <SortableTh label="Tipo" sortKey="tipo" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={thStyle} />
                    <SortableTh label="Estado" sortKey="estado" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={thStyle} />
                    <SortableTh label="Alta" sortKey="alta" activeKey={sortKey} dir={sortDir} onSort={toggleSort} style={thStyle} />
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((user) => {
                    const st = statusStyle(user.authBanned ? "suspendido" : user.status);
                    const busy = processingId === user.id;
                    const isPaused = user.status === "pausado" || user.authBanned;

                    return (
                      <tr key={user.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{user.fullName ?? user.email.split("@")[0]}</div>
                          <div style={{ fontSize: 12, color: "var(--color-slate2)", marginTop: 2 }}>{user.email}</div>
                          {user.orgName && (
                            <div style={{ fontSize: 11, color: "var(--color-slate2)", marginTop: 2 }}>
                              {user.orgName}
                              {user.role ? ` · ${user.role}` : ""}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <NodePill unitCode={user.unitCode} label={user.unitLabel} />
                          {user.role === "medico" || user.role === "paciente" ? (
                            <div style={{ fontSize: 11, color: "var(--color-slate2)", marginTop: 6 }}>
                              {user.role === "medico" ? "Médico" : "Paciente"}
                            </div>
                          ) : null}
                          {user.plan && (
                            <div style={{ fontSize: 11, color: "var(--color-slate2)", marginTop: 6 }}>{user.plan}</div>
                          )}
                        </td>
                        <td style={tdStyle}>{ACCESS_TYPE_LABELS[user.accessType]}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: st.bg,
                              color: st.color,
                            }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: "var(--color-slate2)" }}>{formatDate(user.createdAt)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {isPaused ? (
                              <ActionButton
                                title="Reactivar"
                                disabled={busy}
                                onClick={() => void handleReactivate(user)}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </ActionButton>
                            ) : (
                              <ActionButton
                                title="Pausar"
                                disabled={busy}
                                onClick={() => void handlePause(user)}
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </ActionButton>
                            )}
                            <ActionButton
                              title="Enviar recuperación de contraseña"
                              disabled={busy}
                              onClick={() => void handleSendReset(user)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </ActionButton>
                            <ActionButton
                              title="Cambiar contraseña"
                              disabled={busy || (!user.authUserId && !user.clientId)}
                              onClick={() => {
                                setPasswordUser(user);
                                setNewPassword("");
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </ActionButton>
                            <ActionButton
                              title="Revocar acceso"
                              disabled={busy}
                              danger
                              onClick={() => void handleRevoke(user)}
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </ActionButton>
                            <ActionButton
                              title="Eliminar usuario"
                              disabled={busy}
                              danger
                              onClick={() => void handleDelete(user)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {passwordUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => setPasswordUser(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>Cambiar contraseña</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-slate2)" }}>
              {passwordUser.email} · {passwordUser.unitLabel}
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              autoComplete="new-password"
              style={{
                width: "100%",
                border: "1px solid var(--color-mist)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPasswordUser(null)}
                style={{
                  border: "1px solid var(--color-mist)",
                  background: "white",
                  borderRadius: 8,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={newPassword.trim().length < 8 || processingId === passwordUser.id}
                onClick={() => void handleSavePassword()}
                style={{
                  border: "none",
                  background: "var(--color-brand)",
                  color: "white",
                  borderRadius: 8,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {impactModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => !impactModal.loading && setImpactModal(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--color-navy)" }}>
              {impactModal.action === "delete" ? "Eliminar usuario" : "Revocar acceso"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-slate2)" }}>
              {impactModal.user.email} · {impactModal.user.unitLabel}
            </p>

            {impactModal.loading && !impactModal.preview ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--color-slate2)" }}>
                <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                Analizando impacto…
              </div>
            ) : impactModal.preview ? (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 14 }}>{impactModal.preview.summary}</p>

                {impactModal.preview.warnings.length > 0 && (
                  <div style={{ marginBottom: 12, padding: 12, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
                    {impactModal.preview.warnings.map((w) => (
                      <p key={w} style={{ margin: "0 0 6px", fontSize: 13, color: "#92400E" }}>
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                <div style={{ marginBottom: 16, border: "1px solid var(--color-mist)", borderRadius: 8, overflow: "hidden" }}>
                  {impactModal.preview.lines.map((line) => (
                    <div
                      key={line.id}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--color-mist)",
                        background:
                          line.severity === "destructive"
                            ? "#FEF2F2"
                            : line.severity === "warning"
                              ? "#FFFBEB"
                              : "white",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
                        {line.label}
                        {typeof line.count === "number" ? ` (${line.count})` : ""}
                      </div>
                      {line.detail && (
                        <div style={{ fontSize: 12, color: "var(--color-slate2)", marginTop: 2 }}>{line.detail}</div>
                      )}
                    </div>
                  ))}
                </div>

                {impactModal.action === "delete" && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--color-slate2)" }}>
                      Escribí <strong>{impactModal.user.email}</strong> para confirmar
                    </label>
                    <input
                      type="email"
                      value={impactModal.confirmEmail}
                      onChange={(e) =>
                        setImpactModal({ ...impactModal, confirmEmail: e.target.value, error: null })
                      }
                      placeholder={impactModal.user.email}
                      autoComplete="off"
                      style={{
                        width: "100%",
                        border: "1px solid var(--color-mist)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}

                {impactModal.error && (
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#991B1B" }}>{impactModal.error}</p>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    disabled={impactModal.loading}
                    onClick={() => setImpactModal(null)}
                    style={{
                      border: "1px solid var(--color-mist)",
                      background: "white",
                      borderRadius: 8,
                      padding: "8px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      impactModal.loading ||
                      (impactModal.action === "delete" &&
                        impactModal.confirmEmail.trim().toLowerCase() !== impactModal.user.email.toLowerCase())
                    }
                    onClick={() => void confirmImpactAction()}
                    style={{
                      border: "none",
                      background: impactModal.action === "delete" ? "#DC2626" : "#B45309",
                      color: "white",
                      borderRadius: 8,
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontWeight: 600,
                      opacity: impactModal.loading ? 0.7 : 1,
                    }}
                  >
                    {impactModal.loading
                      ? "Procesando…"
                      : impactModal.action === "delete"
                        ? "Eliminar definitivamente"
                        : "Revocar acceso"}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: "#991B1B", fontSize: 13 }}>{impactModal.error ?? "No se pudo cargar el impacto."}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  style,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  style: React.CSSProperties;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th style={style}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          textTransform: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {label}
        <Icon className="h-3.5 w-3.5" style={{ opacity: active ? 1 : 0.45 }} />
      </button>
    </th>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${danger ? "#FECACA" : "var(--color-mist)"}`,
        background: danger ? "#FEF2F2" : "white",
        color: danger ? "#991B1B" : "var(--color-slate2)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
