/**
 * AuthCallbackPage — handles magic-link, landing-login redirects, and forced password reset.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import {
  enforceNodeAccess,
  fetchMustSetPassword,
  nodeLoginUrlWithAuthError,
  RequiredPasswordForm,
  INVALID_LOGIN_MESSAGE,
  Card,
  CardContent,
  CardHeader,
} from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { LANDING_LOGIN_URL } from "@/shared/lib/auth-redirect";
import { hideAppSplash } from "@/shared/lib/app-splash";
import { acceptPendingInvitations } from "@/shared/lib/accept-pending-invitations";

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

    const mode = new URLSearchParams(window.location.search).get("mode");

    const settle = async () => {
      if (access_token && refresh_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionErr) {
          setError(INVALID_LOGIN_MESSAGE);
          setReady(true);
          hideAppSplash();
          return;
        }
        await supabase.auth.refreshSession();
      } else {
        await supabase.auth.getSession();
      }

      // Auto-accept any pending invitations so the user is added to shared.org_members.
      await acceptPendingInvitations(supabase);

      const mustReset =
        type === "invite" ||
        mode === "invite" ||
        type === "recovery" ||
        (await fetchMustSetPassword(supabase));

      if (mustReset) {
        hideAppSplash();
        setNeedsPassword(true);
        setReady(true);
        return;
      }

      const access = await enforceNodeAccess(supabase, "Finanzas");
      if (!access.ok) {
        hideAppSplash();
        window.location.replace(nodeLoginUrlWithAuthError(LANDING_LOGIN_URL));
        return;
      }

      navigate("/admin/dashboard", { replace: true });
      hideAppSplash();
    };

    void settle().catch(() => {
      hideAppSplash();
      window.location.replace(nodeLoginUrlWithAuthError(LANDING_LOGIN_URL));
    });
  }, [navigate]);

  if (error && ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <a href="/finanzas/login" className="text-sm text-navy underline">
          Volver al login
        </a>
      </div>
    );
  }

  if (needsPassword && ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Card className="w-full max-w-sm shadow-md">
          <CardHeader className="items-center pb-2">
            <BrandMark className="text-2xl" iconClassName="h-9 w-9" />
          </CardHeader>
          <CardContent>
            <RequiredPasswordForm
              supabase={supabase}
              title="Activá tu acceso"
              description="Te invitaron a participar de Nodo Finanzas. Elegí tu contraseña para continuar."
              submitLabel="Activar mi cuenta"
              onSuccess={() => {
                hideAppSplash();
                navigate("/admin/dashboard", { replace: true });
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
