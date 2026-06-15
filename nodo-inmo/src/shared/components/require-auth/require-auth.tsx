/**
 * RequireAuth — protects routes that need an authenticated session.
 *
 * Security note: This guard is a UX convenience ONLY. It prevents
 * unauthenticated users from seeing the UI shell. The actual security
 * boundary is Postgres Row-Level Security (RLS) enforced server-side.
 * The frontend cannot and must not be relied upon as a security layer.
 *
 * Behaviour:
 *   loading         → renders nothing (avoid flash of wrong content)
 *   no session      → Navigate to /login
 *   session + role  → renders children
 *   session, no role → renders a graceful "pending" state
 *                      (claim-sync trigger/Edge Function not yet run)
 */
import { useEffect } from "react";
import { useAuth } from "@nodocore/shared-components";
import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { loading, session, role } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace("/nodo-inmo/login");
    }
  }, [loading, session]);

  if (loading || !session) {
    return null;
  }

  // Session exists but claim-sync hasn't assigned a role yet.
  // This is expected for newly invited users before the Postgres trigger
  // + Edge Function propagates app_metadata. Show a graceful message.
  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
        <h2 className="text-2xl text-navy">Acceso pendiente</h2>
        <p className="max-w-sm text-slate2">
          Tu cuenta está siendo configurada. Esto puede tardar unos instantes.
          Recargá la página en unos segundos o contactá al administrador si el
          problema persiste.
        </p>
        <p className="text-xs text-slate2-300">Setup en curso…</p>
      </div>
    );
  }

  return <>{children}</>;
}
