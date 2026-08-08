import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoleRouter } from "@/app/auth/role-router";
import { RequireAuth } from "@nodocore/shared-components";

import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { OwnerPortalPage } from "@/portals/owner/owner-portal-page";
import { TenantPortalPage } from "@/portals/tenant/tenant-portal-page";

function LoginRedirect() {
  const suffix = `${window.location.search}${window.location.hash}`;
  window.location.replace(`/nodo-inmo/login${suffix}`);
  return null;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate2">404 — page not found</p>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter basename="/inmo">
      <Routes>
        {/* Public routes */}
        {/* /inmo/login redirects to nodo-landing's login — single source of truth */}
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Role dispatch: "/" → admin/owner/tenant portal based on app_metadata.role */}
        <Route path="/" element={<RoleRouter />} />

        {/* Protected portal routes — allowedRoles prevents cross-portal access:
            without it, any authenticated role could reach any portal by URL. */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth allowedRoles={["super_admin", "admin", "agent"]}>
              <AdminPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/owner/*"
          element={
            <RequireAuth allowedRoles={["owner"]}>
              <OwnerPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tenant/*"
          element={
            <RequireAuth allowedRoles={["tenant"]}>
              <TenantPortalPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
