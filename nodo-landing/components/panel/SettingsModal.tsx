"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SettingsModalProps = {
  userId: string;
  userEmail: string;
  initialFullName: string;
  initialRole: string;
  initialAvatarUrl: string | null;
  initials: string;
  initialColor: string;
  isAdmin: boolean;
  onClose: () => void;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dev: "Desarrollador",
  designer: "Diseñador",
  manager: "Gerente",
};

// Palette for the initials avatar — same set used across the panel.
const COLOR_PALETTE = [
  "#2A6FDB",
  "#1F8A5B",
  "#DA5A0E",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#D97706",
  "#475569",
];

const AVATARS_BUCKET = "avatars";

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function SettingsModal({
  userId,
  userEmail,
  initialFullName,
  initialRole,
  initialAvatarUrl,
  initials,
  initialColor,
  isAdmin,
  onClose,
}: SettingsModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [role, setRole] = useState(initialRole);
  const [color, setColor] = useState(initialColor);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no puede superar los 2 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setError("No se pudo subir la imagen: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    if (password) {
      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    // 1. Profile row: name, initials, avatar, and role (only when admin).
    const profileUpdate: Record<string, unknown> = {
      full_name: fullName.trim(),
      initials: getInitials(fullName.trim()),
      avatar_url: avatarUrl,
      color,
    };
    if (isAdmin) {
      profileUpdate.role = role;
    }

    const { data: updatedRows, error: profileErr } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId)
      .select("id");

    if (profileErr) {
      setError("Error al guardar el perfil: " + profileErr.message);
      setSaving(false);
      return;
    }

    // No error but 0 rows means RLS blocked the write silently.
    if (!updatedRows || updatedRows.length === 0) {
      setError(
        "No se guardó ningún cambio. Falta una política RLS en la tabla 'profiles' que te permita editar tu propio perfil."
      );
      setSaving(false);
      return;
    }

    // 2. Auth metadata — keep full_name in sync with what the sidebar reads.
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });
    if (metaErr) {
      setError("Error al actualizar la sesión: " + metaErr.message);
      setSaving(false);
      return;
    }

    // 3. Password (optional).
    if (password) {
      const { error: passErr } = await supabase.auth.updateUser({ password });
      if (passErr) {
        setError("Error al cambiar la contraseña: " + passErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSuccess("Cambios guardados.");
    setPassword("");
    setPasswordConfirm("");
    router.refresh();
  }

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
          width: "min(460px, 92vw)",
          maxHeight: "90vh",
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
            Configuración de la cuenta
          </h3>
          <button
            onClick={onClose}
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
            gap: 16,
          }}
        >
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: "transparent",
                  color: "var(--color-brand)",
                  border: "1px solid var(--color-brand)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {uploading ? "Subiendo..." : "Cambiar foto"}
              </button>
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--color-slate2)" }}>
                JPG o PNG, hasta 2 MB.
              </p>
            </div>
          </div>

          {/* Color de las siglas */}
          <div>
            <label style={labelStyle}>Color de las siglas</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {COLOR_PALETTE.map((c) => {
                const selected = c.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={selected}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: c,
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "white",
                      fontFamily: "var(--font-sans)",
                      border: selected
                        ? "2px solid var(--color-navy)"
                        : "2px solid transparent",
                      boxShadow: selected ? "0 0 0 2px white inset" : "none",
                    }}
                  >
                    {initials}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--color-slate2)" }}>
              Se usa cuando no hay foto de perfil.
            </p>
          </div>

          {/* Nombre de usuario */}
          <div>
            <label style={labelStyle}>Nombre de usuario</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              placeholder="Nombre y apellido"
            />
          </div>

          {/* Email (solo lectura) */}
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={userEmail} disabled style={{ ...inputStyle, background: "var(--color-paper)", color: "var(--color-slate2)" }} />
          </div>

          {/* Tipo de acceso */}
          <div>
            <label style={labelStyle}>Tipo de acceso</label>
            {isAdmin ? (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={inputStyle}
              >
                <option value="admin">Administrador</option>
                <option value="dev">Desarrollador</option>
                <option value="designer">Diseñador</option>
                <option value="manager">Gerente</option>
              </select>
            ) : (
              <input
                type="text"
                value={ROLE_LABELS[role] ?? role}
                disabled
                style={{ ...inputStyle, background: "var(--color-paper)", color: "var(--color-slate2)" }}
              />
            )}
            {!isAdmin && (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--color-slate2)" }}>
                Solo un administrador puede cambiar el tipo de acceso.
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div style={{ borderTop: "1px solid var(--color-mist)", paddingTop: 16 }}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Dejar vacío para no cambiarla"
            />
          </div>
          {password && (
            <div>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={inputStyle}
                placeholder="Repetir la nueva contraseña"
              />
            </div>
          )}

          {error && <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>{error}</p>}
          {success && <p style={{ margin: 0, fontSize: 12.5, color: "#1F8A5B" }}>{success}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              style={{
                flex: 1,
                background: "var(--color-brand)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: saving || uploading ? "not-allowed" : "pointer",
                fontFamily: "var(--font-sans)",
                opacity: saving || uploading ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={onClose}
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
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
