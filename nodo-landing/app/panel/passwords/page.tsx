"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";

type VaultEntry = {
  id: string;
  label: string;
  service: string | null;
  username: string | null;
  password: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
};

const SERVICE_COLORS: Record<string, string> = {
  github: "#24292F",
  supabase: "#3ECF8E",
  vercel: "#000000",
  aws: "#FF9900",
  google: "#4285F4",
  slack: "#4A154B",
  figma: "#F24E1E",
  notion: "#000000",
  docker: "#2496ED",
  cloudflare: "#F38020",
};

function getServiceColor(service: string | null): string {
  if (!service) return "var(--color-slate2)";
  const key = service.toLowerCase();
  for (const [name, color] of Object.entries(SERVICE_COLORS)) {
    if (key.includes(name)) return color;
  }
  return "var(--color-brand)";
}

export default function PasswordsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const [formLabel, setFormLabel] = useState("");
  const [formService, setFormService] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function getEmail() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    getEmail();
  }, []);

  async function handleUnlock() {
    if (!pin.trim()) return;
    setVerifying(true);
    setPinError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: pin,
    });
    if (error) {
      setPinError("Contraseña incorrecta.");
      setVerifying(false);
      return;
    }
    setUnlocked(true);
    setVerifying(false);
    loadEntries();
  }

  async function loadEntries() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("vault_entries")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as VaultEntry[]);
    setLoading(false);
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function openAddForm() {
    setEditingEntry(null);
    setFormLabel("");
    setFormService("");
    setFormUsername("");
    setFormPassword("");
    setFormUrl("");
    setFormNotes("");
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(entry: VaultEntry) {
    setEditingEntry(entry);
    setFormLabel(entry.label);
    setFormService(entry.service ?? "");
    setFormUsername(entry.username ?? "");
    setFormPassword(entry.password ?? "");
    setFormUrl(entry.url ?? "");
    setFormNotes(entry.notes ?? "");
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!formLabel.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError("");
    const supabase = createClient();
    const payload = {
      label: formLabel.trim(),
      service: formService.trim() || null,
      username: formUsername.trim() || null,
      password: formPassword || null,
      url: formUrl.trim() || null,
      notes: formNotes.trim() || null,
    };

    if (editingEntry) {
      const { error } = await supabase
        .from("vault_entries")
        .update(payload)
        .eq("id", editingEntry.id);
      if (error) {
        setFormError("Error al actualizar.");
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("vault_entries")
        .insert({ ...payload, created_by: user?.id ?? null });
      if (error) {
        setFormError("Error al guardar.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setShowForm(false);
    loadEntries();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("vault_entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  }

  const filtered = searchTerm
    ? entries.filter(
        (e) =>
          e.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.service?.toLowerCase().includes(searchTerm.toLowerCase()) ??
            false) ||
          (e.username?.toLowerCase().includes(searchTerm.toLowerCase()) ??
            false),
      )
    : entries;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-mist)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13.5,
    fontFamily: "var(--font-sans)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--color-slate2)",
    marginBottom: 4,
    display: "block",
  };

  // ── Lock screen ──
  if (!unlocked) {
    return (
      <>
        <Topbar
          breadcrumb="Nodo Core · Seguridad"
          title="Bóveda de Contraseñas"
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder=""
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "white",
              border: "1px solid var(--color-mist)",
              borderRadius: 16,
              padding: "40px 36px",
              width: "min(400px, 90vw)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--color-navy)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--color-navy)",
                fontFamily: "var(--font-display)",
              }}
            >
              Bóveda protegida
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                fontSize: 14,
                color: "var(--color-slate2)",
                lineHeight: 1.5,
              }}
            >
              Ingrese su contraseña de cuenta para acceder a las credenciales
              guardadas.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUnlock();
              }}
            >
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Contraseña"
                autoFocus
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: 15,
                  padding: "12px 16px",
                  marginBottom: pinError ? 8 : 16,
                }}
              />
              {pinError && (
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12.5,
                    color: "#C0392B",
                  }}
                >
                  {pinError}
                </p>
              )}
              <button
                type="submit"
                disabled={verifying}
                style={{
                  width: "100%",
                  background: "var(--color-navy)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "11px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: verifying ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-sans)",
                  opacity: verifying ? 0.7 : 1,
                }}
              >
                {verifying ? "Verificando..." : "Desbloquear"}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // ── Vault content ──
  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Seguridad"
        title="Contraseñas"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar credenciales..."
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate2)" }}>
            {filtered.length}{" "}
            {filtered.length === 1 ? "credencial" : "credenciales"} guardadas
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                setUnlocked(false);
                setPin("");
                setRevealedIds(new Set());
              }}
              style={{
                background: "transparent",
                color: "var(--color-slate2)",
                border: "1px solid var(--color-mist)",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Bloquear
            </button>
            <button
              onClick={openAddForm}
              style={{
                background: "var(--color-brand)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              + Agregar credencial
            </button>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--color-slate2)",
              fontSize: 14,
            }}
          >
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "var(--color-slate2)",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p style={{ margin: 0, fontSize: 14 }}>
              {searchTerm
                ? "No se encontraron credenciales."
                : "No hay credenciales guardadas. Agregue la primera."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((entry) => {
              const revealed = revealedIds.has(entry.id);
              const serviceColor = getServiceColor(entry.service);
              return (
                <div
                  key={entry.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--color-mist)",
                    borderRadius: 12,
                    padding: "18px 22px",
                    transition: "box-shadow 150ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(18,30,47,.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Top row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: serviceColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "white",
                        flexShrink: 0,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {(entry.service ?? entry.label).slice(0, 2).toUpperCase()}
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
                        {entry.label}
                      </p>
                      {entry.service && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 12.5,
                            color: "var(--color-slate2)",
                          }}
                        >
                          {entry.service}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => openEditForm(entry)}
                        title="Editar"
                        style={{
                          background: "transparent",
                          border: "1px solid var(--color-mist)",
                          borderRadius: 6,
                          width: 32,
                          height: 32,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-slate2)",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {confirmDeleteId === entry.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            style={{
                              background: "#C0392B",
                              color: "white",
                              border: "none",
                              borderRadius: 6,
                              padding: "0 10px",
                              height: 32,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "var(--font-sans)",
                            }}
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              background: "transparent",
                              color: "var(--color-slate2)",
                              border: "1px solid var(--color-mist)",
                              borderRadius: 6,
                              padding: "0 8px",
                              height: 32,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "var(--font-sans)",
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(entry.id)}
                          title="Eliminar"
                          style={{
                            background: "transparent",
                            border: "1px solid #F5C6C2",
                            borderRadius: 6,
                            width: 32,
                            height: 32,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#C0392B",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Credential fields */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                      background: "#F8FAFC",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    {entry.username && (
                      <div>
                        <p
                          style={{
                            margin: "0 0 3px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--color-slate2)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Usuario
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <code
                            style={{
                              fontSize: 13.5,
                              color: "var(--color-ink)",
                              fontFamily: "monospace",
                            }}
                          >
                            {entry.username}
                          </code>
                          <button
                            onClick={() => copyToClipboard(entry.username!)}
                            title="Copiar"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--color-slate2)",
                              padding: 2,
                              display: "flex",
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {entry.password && (
                      <div>
                        <p
                          style={{
                            margin: "0 0 3px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--color-slate2)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Contraseña
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <code
                            style={{
                              fontSize: 13.5,
                              color: "var(--color-ink)",
                              fontFamily: "monospace",
                            }}
                          >
                            {revealed ? entry.password : "••••••••••"}
                          </code>
                          <button
                            onClick={() => toggleReveal(entry.id)}
                            title={revealed ? "Ocultar" : "Mostrar"}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--color-slate2)",
                              padding: 2,
                              display: "flex",
                            }}
                          >
                            {revealed ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(entry.password!)}
                            title="Copiar"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--color-slate2)",
                              padding: 2,
                              display: "flex",
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {entry.url && (
                      <div>
                        <p
                          style={{
                            margin: "0 0 3px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--color-slate2)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          URL
                        </p>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 13,
                            color: "var(--color-brand)",
                            textDecoration: "none",
                            wordBreak: "break-all",
                          }}
                        >
                          {entry.url}
                        </a>
                      </div>
                    )}
                  </div>

                  {entry.notes && (
                    <p
                      style={{
                        margin: "10px 0 0",
                        fontSize: 13,
                        color: "var(--color-slate2)",
                        lineHeight: 1.5,
                      }}
                    >
                      {entry.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18,30,47,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 12,
                width: "min(480px, 92vw)",
                maxHeight: "85vh",
                overflowY: "auto",
                boxShadow: "0 12px 40px rgba(18,30,47,.18)",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--color-mist)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "sticky",
                  top: 0,
                  background: "white",
                  borderRadius: "12px 12px 0 0",
                  zIndex: 1,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--color-navy)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {editingEntry ? "Editar credencial" : "Nueva credencial"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-slate2)",
                    fontSize: 20,
                    lineHeight: 1,
                    padding: "2px 4px",
                    borderRadius: 4,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej: Base de datos producción"
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Servicio</label>
                  <input
                    type="text"
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej: Supabase, GitHub, Vercel, AWS..."
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Usuario / Email</label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      style={inputStyle}
                      placeholder="usuario@email.com"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contraseña</label>
                    <input
                      type="text"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      style={inputStyle}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>URL</label>
                  <input
                    type="text"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    style={inputStyle}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label style={labelStyle}>Notas</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                    placeholder="Datos adicionales, claves API, connection strings..."
                  />
                </div>

                {formError && (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>
                    {formError}
                  </p>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: "var(--color-brand)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                      fontFamily: "var(--font-sans)",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving
                      ? "Guardando..."
                      : editingEntry
                        ? "Guardar cambios"
                        : "Guardar credencial"}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      color: "var(--color-slate2)",
                      border: "1px solid var(--color-mist)",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
