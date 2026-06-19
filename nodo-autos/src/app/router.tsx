import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoleRouter } from "@/app/auth/role-router";
import { RequireAuth } from "@/shared/components/require-auth/require-auth";
import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { PublicVehiclePage } from "@/features/public-vehicle/public-vehicle-page";

function LoginRedirect() {
  window.location.replace("/nodo-autos/login");
  return null;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate2">404 — página no encontrada</p>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter basename="/autos">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Public vehicle page — no login required */}
        <Route path="/x/:slug" element={<PublicVehiclePage />} />
        <Route path="/:clienteIdentificador/:slug" element={<PublicVehiclePage />} />

        {/* Role dispatch: "/" → admin */}
        <Route path="/" element={<RoleRouter />} />

        {/* Protected admin portal */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <AdminPortalPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
