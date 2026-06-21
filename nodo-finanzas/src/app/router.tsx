import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { useAuth } from "@nodocore/shared-components";
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

/** Hide splash once auth is ready and on every client-side navigation. */
function SplashAutoHide({ loading }: { loading: boolean }) {
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    hideAppSplash();
  }, [loading, location.pathname]);

  return null;
}

export function AppRouter() {
  const { session, isLoading: loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    hideAppSplash();
  }, [loading]);

  useEffect(() => {
    const failSafe = window.setTimeout(() => hideAppSplash(), 10_000);
    return () => window.clearTimeout(failSafe);
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter basename="/finanzas">
      <SplashAutoHide loading={loading} />
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
