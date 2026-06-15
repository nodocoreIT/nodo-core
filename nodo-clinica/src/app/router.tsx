import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoleRouter } from "@/app/auth/role-router";
import { RequireAuth } from "@/shared/components/require-auth/require-auth";

import { AuthCallbackPage } from "@/features/auth/callback/auth-callback-page";
import { MedicoRegisterPage } from "@/features/auth/register/medico-register-page";
import { PacienteRegisterPage } from "@/features/auth/register/paciente-register-page";
import { MedicoPortalPage } from "@/portals/medico/medico-portal-page";
import { PacientePortalPage } from "@/portals/paciente/paciente-portal-page";

function LoginRedirect() {
  window.location.replace("/nodo-clinica/login");
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
    <BrowserRouter basename="/clinica">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/register/medico" element={<MedicoRegisterPage />} />
        <Route path="/register/paciente" element={<PacienteRegisterPage />} />

        {/* Role dispatch: "/" → medico/paciente portal based on app_metadata.role */}
        <Route path="/" element={<RoleRouter />} />

        {/* Protected portal routes */}
        <Route
          path="/medico/*"
          element={
            <RequireAuth>
              <MedicoPortalPage />
            </RequireAuth>
          }
        />
        <Route
          path="/paciente/*"
          element={
            <RequireAuth>
              <PacientePortalPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
