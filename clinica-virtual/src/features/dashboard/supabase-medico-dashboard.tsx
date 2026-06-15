import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@nodocore/shared-components";
import { MedicoDashboard } from "@/features/dashboard/medico-dashboard";

/**
 * Supabase-aware wrapper for the medico dashboard.
 * Uses useAuth() from shared-components instead of server-side cookie auth.
 * Redirects to /login if the user is not authenticated or is not a doctor.
 */
export function SupabaseMedicoDashboard() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  const role = (session?.user?.user_metadata as Record<string, string> | undefined)?.role;

  useEffect(() => {
    if (isLoading) return;
    if (!session || role !== "doctor") {
      navigate("/login", { replace: true });
    }
  }, [session, role, isLoading, navigate]);

  if (isLoading || !session || role !== "doctor") {
    return null;
  }

  return <MedicoDashboard />;
}
