import { Navigate } from "react-router-dom";
import { useAuth } from "@/shared/hooks/use-auth";
import { redirectToLandingLogin } from "@/shared/lib/auth-redirect";
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
    redirectToLandingLogin();
    return null;
  }

  return <Navigate to="/admin/dashboard" replace />;
}
