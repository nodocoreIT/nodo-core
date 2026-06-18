import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { useAuth } from "@/shared/hooks/use-auth";
import { redirectToLandingLogin } from "@/shared/lib/auth-redirect";
import { Spinner } from "@/components/ui/spinner";

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function LoginRedirect() {
  redirectToLandingLogin();
  return null;
}

function UnauthenticatedRedirect() {
  redirectToLandingLogin();
  return null;
}

export function AppRouter() {
  const { session, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;

  return (
    <BrowserRouter basename="/finanzas">
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/login"
          element={
            session ? <Navigate to="/admin/dashboard" replace /> : <LoginRedirect />
          }
        />
        <Route
          path="/*"
          element={session ? <AdminPortalPage /> : <UnauthenticatedRedirect />}
        />
      </Routes>
    </BrowserRouter>
  );
}
