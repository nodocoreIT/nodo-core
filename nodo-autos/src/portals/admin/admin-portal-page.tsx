import { Routes, Route, Navigate } from "react-router-dom";
import { PlanGate } from "@nodocore/shared-components";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { VehiclesListPage } from "@/features/vehicles/vehicles-list-page";
import { VehicleFormPage } from "@/features/vehicles/vehicle-form-page";
import { VehicleDetailPage } from "@/features/vehicles/vehicle-detail-page";
import { VehicleImportPage } from "@/features/vehicles/vehicle-import-page";
import { CustomersListPage } from "@/features/customers/customers-list-page";
import { PublicationsPage } from "@/features/publications/publications-page";
import { PublicationDetailPage } from "@/features/publications/publication-detail-page";
import { ContractsPage } from "@/features/contracts/contracts-page";
import { AutosAgendaPage } from "@/features/agenda/agenda-page";
import { AutosCajaPage } from "@/features/caja/caja-page";

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="vehiculos" element={<VehiclesListPage />} />
        <Route path="vehiculos/importar" element={<VehicleImportPage />} />
        <Route path="vehiculos/nuevo" element={<VehicleFormPage />} />
        <Route path="vehiculos/:id" element={<VehicleDetailPage />} />
        <Route path="vehiculos/:id/editar" element={<VehicleFormPage />} />
        <Route path="clientes" element={<CustomersListPage />} />
        <Route path="publicaciones" element={<PublicationsPage />} />
        <Route path="publicaciones/:id" element={<PublicationDetailPage />} />
        <Route path="caja" element={<AutosCajaPage />} />
        <Route path="agenda" element={<AutosAgendaPage />} />
        <Route path="documentacion" element={<ContractsPage />} />
        <Route path="contratos" element={<Navigate to="/admin/documentacion" replace />} />
        <Route path="nodo-id" element={<PlanGate requiredPlan="pro" fullPage><div /></PlanGate>} />
        <Route path="bot-integraciones" element={<PlanGate requiredPlan="pro" fullPage><div /></PlanGate>} />
      </Route>
    </Routes>
  );
}
