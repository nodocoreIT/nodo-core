import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { useAuth } from "@/shared/hooks/use-auth";
import { redirectToLandingLogin } from "@/shared/lib/auth-redirect";
import { hideAppSplash } from "@/shared/lib/app-splash";

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

  useEffect(() => {
    if (loading) return;
    const onCallback = window.location.pathname.includes("/auth/callback");
    if (!onCallback) hideAppSplash();
  }, [loading]);

  // Keep index.html splash visible while auth resolves (avoids bg-paper flash).
  if (loading) return null;

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
