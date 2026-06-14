/**
 * RequireAuth — protects routes that need an authenticated session.
 *
 * Security note: This guard is a UX convenience ONLY. It prevents
 * unauthenticated users from seeing the UI shell. The actual security
 * boundary is Postgres Row-Level Security (RLS) enforced server-side.
 *
 * Behaviour:
 *   isLoading         → renders nothing (avoid flash of wrong content)
 *   no session        → Navigate to /login
 *   session + role    → renders children (filtered by allowedRoles if provided)
 *   session, no role  → renders a graceful "pending" state
 *   wrong role        → Navigate to /login
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-provider";
import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
  /** If provided, only these roles are permitted. Omit to allow any authenticated role. */
  allowedRoles?: string[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { isLoading, session, role } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Session exists but claim-sync hasn't assigned a role yet.
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

  // Role-based guard
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
