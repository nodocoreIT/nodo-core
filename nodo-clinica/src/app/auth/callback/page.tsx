"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * /auth/callback — was a server route.ts that only handled `?code=` (PKCE
 * exchange). NodoSwitcher's cross-origin relay (packages/nodo-modules/src/orgs/nodo-switcher.tsx
 * crossOriginCallbackUrl) sends `#access_token=...&refresh_token=...` instead
 * — a hash fragment, which a server route can never see (fragments are
 * client-only, never sent in the HTTP request). That mismatch left the
 * incoming session unprocessed, and the token sat unresolved through a chain
 * of redirects. Converted to a client page that reads the hash directly,
 * mirroring nodo-autos's src/features/auth/callback/auth-callback-page.tsx.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function settle() {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const next = searchParams.get("next");

      if (accessToken && refreshToken) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionErr) {
          setError("No se pudo restablecer la sesión. Iniciá sesión de nuevo.");
          return;
        }
      } else if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          if (next?.includes("actualizar-contrasena")) {
            window.location.replace(`${next}?error=link_expired`);
            return;
          }
          setError("El enlace expiró o ya fue usado.");
          return;
        }
      } else {
        window.location.replace("/login");
        return;
      }

      if (next) {
        window.location.replace(next);
        return;
      }

      // No explicit next — resolve médico vs paciente from the session that
      // was just established, same source of truth as medico-admin-layout.tsx.
      try {
        const res = await fetch("/api/clinic/account/session", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { session?: { role?: string } };
          window.location.replace(data.session?.role === "doctor" ? "/medico/dashboard" : "/paciente");
          return;
        }
      } catch {
        // fall through to default below
      }
      window.location.replace("/medico/dashboard");
    }

    void settle();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <a href="/login" className="text-sm text-navy underline">
          Volver al login
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-slate2">Verificando sesión…</p>
    </div>
  );
}
