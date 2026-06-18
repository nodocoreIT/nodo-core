import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { LoginPage } from "@/features/auth/login-page";
import { useAuth } from "@/shared/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
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
          element={session ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={session ? <AdminPortalPage /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
