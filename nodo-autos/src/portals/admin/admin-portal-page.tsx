import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { VehiclesListPage } from "@/features/vehicles/vehicles-list-page";
import { VehicleFormPage } from "@/features/vehicles/vehicle-form-page";
import { VehicleDetailPage } from "@/features/vehicles/vehicle-detail-page";
import { CustomersListPage } from "@/features/customers/customers-list-page";
import { PublicationsPage } from "@/features/publications/publications-page";
import { PublicationDetailPage } from "@/features/publications/publication-detail-page";
import { ConfigPage } from "@/features/config/config-page";
import { ContractsPage } from "@/features/contracts/contracts-page";

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
        <Route path="publicaciones/:id" element={<PublicationDetailPage />} />
        <Route path="contratos" element={<ContractsPage />} />
        <Route path="configuracion" element={<ConfigPage />} />
      </Route>
    </Routes>
  );
}
