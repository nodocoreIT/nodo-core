/**
 * RequireAuth — protects routes that need an authenticated session.
 *
 * Security note: This guard is a UX convenience ONLY. The actual security
 * boundary is Postgres Row-Level Security (RLS) enforced server-side.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@nodocore/shared-components";
import { autosDb } from "@/shared/lib/supabase";

const AUTOS_ROLES = new Set(["administrador", "vendedor", "marketing"]);

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, session } = useAuth();
  const [autosRole, setAutosRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setAutosRole(null);
      setRoleLoading(false);
      return;
    }

    let cancelled = false;
    setRoleLoading(true);

    autosDb()
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAutosRole((data?.role as string | undefined) ?? null);
        setRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (isLoading || roleLoading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!autosRole || !AUTOS_ROLES.has(autosRole)) {
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
