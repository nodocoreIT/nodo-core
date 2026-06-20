/**
 * AuthCallbackPage — handles magic-link, OAuth, landing-login redirects, and forced password reset.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import {
  enforceNodeAccess,
  fetchMustSetPassword,
  INVALID_LOGIN_MESSAGE,
  RequiredPasswordForm,
} from "@nodocore/shared-components";

const LANDING_ORIGIN = import.meta.env.VITE_LANDING_URL ?? "http://localhost:3000";

async function provisionTienda(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${LANDING_ORIGIN}/api/tienda/provision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn("[tienda/provision] provision call failed:", res.status, body);
    }
  } catch (e) {
    console.warn("[tienda/provision] provision call failed:", e);
  }
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [needsPassword, setNeedsPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    const settle = async () => {
      if (access_token && refresh_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionErr) {
          setError(INVALID_LOGIN_MESSAGE);
          setReady(true);
          return;
        }

        // Provision Tienda on first login (idempotent)
        await provisionTienda(access_token);

        await supabase.auth.refreshSession();
      } else {
        await supabase.auth.getSession();
      }

      const mustReset =
        type === "invite" ||
        type === "recovery" ||
        (await fetchMustSetPassword(supabase));

      if (mustReset) {
        setNeedsPassword(true);
        setReady(true);
        return;
      }

      const access = await enforceNodeAccess(supabase, "Tienda");
      if (!access.ok) {
        setError(access.message);
        setReady(true);
        return;
      }

      navigate("/", { replace: true });
    };

    void settle();
  }, [navigate]);

  if (error && ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <a href="/nodo-tienda/login" className="text-sm text-navy underline">
          Volver al login
        </a>
      </div>
    );
  }

  if (needsPassword && ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <RequiredPasswordForm
          supabase={supabase}
          title="Definí tu nueva contraseña"
          description="Tu acceso fue blanqueado. Elegí una contraseña nueva y repetila para continuar."
          submitLabel="Continuar"
          onSuccess={() => navigate("/", { replace: true })}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
