import { useAuth } from "@nodocore/shared-components";
import { redirectToLandingLogin } from "@/shared/lib/auth-redirect";
import { Spinner } from "@/components/ui/spinner";
import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { session, isLoading: loading } = useAuth();

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

  return <>{children}</>;
}
