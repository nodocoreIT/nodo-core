import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoleRouter } from "@/app/auth/role-router";
import { RequireAuth } from "@/shared/components/require-auth/require-auth";
import { PlanGate } from "@/shared/components/plan-gate";

import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { AdminPortalPage } from "@/portals/admin/admin-portal-page";
import { CustomerPortalPage } from "@/portals/customer/customer-portal-page";

function LoginRedirect() {
  window.location.replace("/nodo-tienda/login");
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
    <BrowserRouter basename="/tienda">
      <Routes>
        {/* Public routes */}
        {/* /tienda/login redirects to nodo-landing's login — single source of truth */}
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Role dispatch: "/" → admin/staff/customer portal based on app_metadata.role */}
        <Route path="/" element={<RoleRouter />} />

        {/* Protected portal routes */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <AdminPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/customer/*"
          element={
            <RequireAuth>
              <PlanGate requiredPlan="pro" fullPage>
                <CustomerPortalPage />
              </PlanGate>
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
