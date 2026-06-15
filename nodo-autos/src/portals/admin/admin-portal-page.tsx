import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { VehiclesListPage } from "@/features/vehicles/vehicles-list-page";
import { VehicleFormPage } from "@/features/vehicles/vehicle-form-page";
import { VehicleDetailPage } from "@/features/vehicles/vehicle-detail-page";
import { CustomersListPage } from "@/features/customers/customers-list-page";
import { PublicationsPage } from "@/features/publications/publications-page";
import { ConfigPage } from "@/features/config/config-page";

function ContratosPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-slate2 text-sm">Módulo de contratos — próximamente.</p>
    </div>
  );
}

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="vehiculos" element={<VehiclesListPage />} />
        <Route path="vehiculos/nuevo" element={<VehicleFormPage />} />
        <Route path="vehiculos/:id" element={<VehicleDetailPage />} />
        <Route path="vehiculos/:id/editar" element={<VehicleFormPage />} />
        <Route path="clientes" element={<CustomersListPage />} />
        <Route path="publicaciones" element={<PublicationsPage />} />
        <Route path="contratos" element={<ContratosPlaceholder />} />
        <Route path="configuracion" element={<ConfigPage />} />
      </Route>
    </Routes>
  );
}
