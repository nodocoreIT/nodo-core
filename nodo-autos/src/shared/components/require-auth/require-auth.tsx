/**
 * RequireAuth — protects routes that need an authenticated session.
 *
 * Security note: This guard is a UX convenience ONLY. The actual security
 * boundary is Postgres Row-Level Security (RLS) enforced server-side.
 *
 * Role source: JWT app_metadata claims via shared AuthProvider.
 * The legacy DB query to nodo_autos.users has been removed.
 */
import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@nodocore/shared-components";

const AUTOS_ROLES = new Set(["super_admin", "admin", "seller", "guest"]);

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, session, role } = useAuth();

  if (isLoading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !AUTOS_ROLES.has(role)) {
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
