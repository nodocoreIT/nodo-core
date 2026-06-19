/**
 * AuthCallbackPage — handles OAuth and landing-login redirects with hash tokens.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { enforceNodeAccess, nodeLoginUrlWithAuthError } from "@nodocore/shared-components";
import { LANDING_LOGIN_URL } from "@/shared/lib/auth-redirect";
import { hideAppSplash } from "@/shared/lib/app-splash";

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

      const access = await enforceNodeAccess(supabase, "Finanzas");
      if (!access.ok) {
        hideAppSplash();
        window.location.replace(nodeLoginUrlWithAuthError(LANDING_LOGIN_URL));
        return;
      }

      navigate("/admin/dashboard", { replace: true });
    };

    settle();
  }, [navigate]);

  // Splash from index.html stays visible until AppRouter hides it after navigation.
  return null;
}
