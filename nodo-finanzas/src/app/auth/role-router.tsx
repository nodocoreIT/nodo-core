import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export function RoleRouter() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/admin/dashboard" replace />;
}
