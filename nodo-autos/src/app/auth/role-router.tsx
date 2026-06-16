/**
 * RoleRouter — dispatches authenticated users to the admin portal.
 *
 * Security note: This routing is a UX convenience ONLY.
 * Authorization is enforced server-side via Postgres RLS.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@nodocore/shared-components";

export function RoleRouter() {
  const { loading, session } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // All authenticated users go to admin
  return <Navigate to="/admin" replace />;
}
