"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  full_name: string;
  role: string;
  initials: string;
  color: string;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dev: "Desarrollador",
  designer: "Diseñador",
  manager: "Gerente",
};

export default function EquipoPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("dev");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, initials, color, created_at")
      .order("created_at");
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  function openAddForm() {
    setEditingMember(null);
    setFormName("");
    setFormRole("dev");
    setFormEmail("");
    setFormPassword("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(member: Member) {
    setEditingMember(member);
    setFormName(member.full_name);
    setFormRole(member.role);
    setFormEmail("");
    setFormPassword("");
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();

    if (editingMember) {
      const initials = getInitials(formName.trim());
      const { error: err } = await supabase
        .from("profiles")
        .update({ full_name: formName.trim(), role: formRole, initials })
        .eq("id", editingMember.id);
      if (err) {
        setError("Error al actualizar el miembro.");
        setSaving(false);
        return;
      }
    } else {
      if (!formEmail.trim() || !formPassword.trim()) {
        setError("El email y la contraseña son obligatorios para nuevos miembros.");
        setSaving(false);
        return;
      }
      // Create via the admin API on the server so the user is confirmed and our
      // own admin session is left intact (client signUp would break both).
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          role: formRole,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "Error al crear el usuario.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    loadMembers();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("profiles").delete().eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  const filtered = searchTerm
    ? members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.role.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : members;

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

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Gestión"
        title="Equipo"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar miembros..."
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {/* Header + Add button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate2)" }}>
            {filtered.length} {filtered.length === 1 ? "miembro" : "miembros"} del equipo
          </p>
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
            + Agregar miembro
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            Cargando equipo...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            No se encontraron miembros.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filtered.map((member) => (
              <div
                key={member.id}
                style={{
                  background: "white",
                  border: "1px solid var(--color-mist)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  transition: "box-shadow 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(18,30,47,.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: member.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {member.initials}
                </div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--color-navy)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {member.full_name}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-slate2)" }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => openEditForm(member)}
                    style={{
                      background: "transparent",
                      color: "var(--color-brand)",
                      border: "1px solid var(--color-brand)",
                      borderRadius: 6,
                      padding: "5px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    style={{
                      background: "transparent",
                      color: "#C0392B",
                      border: "1px solid #F5C6C2",
                      borderRadius: 6,
                      padding: "5px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
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
                width: "min(440px, 92vw)",
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
                  {editingMember ? "Editar miembro" : "Nuevo miembro"}
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

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre completo</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={inputStyle}
                    placeholder="Nombre y apellido"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Rol</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="admin">Administrador</option>
                    <option value="dev">Desarrollador</option>
                    <option value="designer">Diseñador</option>
                    <option value="manager">Gerente</option>
                  </select>
                </div>

                {!editingMember && (
                  <>
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        style={inputStyle}
                        placeholder="email@ejemplo.com"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Contraseña</label>
                      <input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        style={inputStyle}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>{error}</p>
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
                    {saving ? "Guardando..." : editingMember ? "Guardar cambios" : "Crear miembro"}
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
