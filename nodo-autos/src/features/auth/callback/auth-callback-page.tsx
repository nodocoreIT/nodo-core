/**
 * AuthCallbackPage — handles magic-link and landing-login redirects.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { fetchMustSetPassword, RequiredPasswordForm } from "@nodocore/shared-components";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [needsPassword, setNeedsPassword] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    const settle = async () => {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else {
        await supabase.auth.getSession();
      }

      if (await fetchMustSetPassword(supabase)) {
        setNeedsPassword(true);
        setReady(true);
        return;
      }

      navigate("/", { replace: true });
    };

    void settle();
  }, [navigate]);

  if (needsPassword && ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <RequiredPasswordForm
          supabase={supabase}
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
