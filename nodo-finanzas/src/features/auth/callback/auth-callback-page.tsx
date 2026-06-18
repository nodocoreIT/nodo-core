/**
 * AuthCallbackPage — handles OAuth and landing-login redirects with hash tokens.
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

    const settle = async () => {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else {
        await supabase.auth.getSession();
      }
      navigate("/admin/dashboard", { replace: true });
    };

    settle();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
