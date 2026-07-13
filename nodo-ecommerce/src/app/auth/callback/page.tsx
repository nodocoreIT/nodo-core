"use client";

/**
 * Auth Callback — handles session transfer from nodo-landing.
 *
 * Flow:
 *   nodo-landing login → /ecommerce/auth/callback#access_token=...&refresh_token=...
 *   This page reads the hash, sets the Supabase session, then redirects to the dashboard.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1); // remove leading #
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/login");
      return;
    }

    const supabase = createClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error("[auth/callback] setSession error:", error.message);
          router.replace("/login");
        } else {
          router.replace("/dashboard");
        }
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4 text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-yellow-400" />
        <p className="text-sm font-medium">Iniciando sesión…</p>
      </div>
    </div>
  );
}
