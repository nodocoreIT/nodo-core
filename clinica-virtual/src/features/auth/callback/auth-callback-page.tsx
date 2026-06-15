/**
 * AuthCallbackPage — handles magic-link and OAuth redirects.
 *
 * Supabase JS v2 detects the session from the URL fragment automatically.
 * We parse the hash tokens explicitly to ensure they are stored in localStorage
 * before redirecting the user to the role-dispatching route.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ data }) => {
          if (data.session) navigate("/");
        });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate("/");
      });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
