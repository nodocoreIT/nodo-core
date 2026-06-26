/**
 * AuthCallbackPage — handles magic-link, OAuth, landing-login redirects, and forced password reset.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { acceptPendingInvitations } from "@/shared/lib/accept-pending-invitations";
import {
  enforceNodeAccess,
  fetchMustSetPassword,
  INVALID_LOGIN_MESSAGE,
  RequiredPasswordForm,
  Card,
  CardContent,
  CardHeader,
} from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [needsPassword, setNeedsPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | undefined>();
  const [inviteRole, setInviteRole] = useState<string | undefined>();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");
    setInviterName(searchParams.get("inviter") ?? undefined);
    setInviteRole(searchParams.get("role") ?? undefined);

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
        await supabase.auth.refreshSession();
      } else {
        await supabase.auth.getSession();
      }

      // Auto-accept any pending invitations so the user is added to org_members.
      await acceptPendingInvitations(supabase);

      const mustReset =
        type === "invite" ||
        mode === "invite" ||
        type === "recovery" ||
        (await fetchMustSetPassword(supabase));

      if (mustReset) {
        setNeedsPassword(true);
        setReady(true);
        return;
      }

      const access = await enforceNodeAccess(supabase, "Inmo");
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
        <a href="/nodo-inmo/login" className="text-sm text-navy underline">
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
              description={
                inviterName
                  ? `${inviteRole ? `Ingresá tu contraseña para acceder como ${inviteRole}` : "Ingresá tu contraseña para continuar"} — te invitó ${inviterName}.`
                  : "Te invitaron a participar de Nodo Inmo. Elegí tu contraseña para continuar."
              }
              submitLabel="Activar mi cuenta"
              onSuccess={() => navigate("/", { replace: true })}
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
