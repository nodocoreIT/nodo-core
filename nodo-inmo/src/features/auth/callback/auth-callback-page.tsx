/**
 * AuthCallbackPage — handles magic-link, OAuth, and staff invitation redirects.
 *
 * When type=invite in the URL hash: set the session then prompt the user to
 * choose a permanent password before entering the app.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { Button } from "@nodocore/shared-components";
import { Input } from "@nodocore/shared-components";
import { Label } from "@nodocore/shared-components";

// ── Set-password form shown after accepting an invite ─────────────────────────

function SetPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-navy">Activá tu cuenta</h1>
          <p className="text-sm text-slate2">Elegí una contraseña para ingresar al sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Ingresé contraseña…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirmá la contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repetí la contraseña…"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Activar cuenta"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Main callback handler ─────────────────────────────────────────────────────

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [isInvite, setIsInvite] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    const settle = async () => {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else {
        await supabase.auth.getSession();
      }

      if (type === "invite" || type === "recovery") {
        // Stay on this page and show the set-password form
        setIsInvite(true);
        setReady(true);
      } else {
        navigate("/");
      }
    };

    settle();
  }, [navigate]);

  if (isInvite && ready) return <SetPasswordForm />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
