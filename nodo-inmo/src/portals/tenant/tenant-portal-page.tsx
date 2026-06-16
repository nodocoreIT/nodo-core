import { Routes, Route, Navigate } from "react-router-dom";
import { TenantLayout } from "./components/tenant-layout";
import { TenantContractPage } from "./components/tenant-contract-page";
import { TenantPaymentsPage } from "./components/tenant-payments-page";
import { TenantReclamosPage } from "./components/tenant-reclamos-page";

export function TenantPortalPage() {
  return (
    <Routes>
      <Route element={<TenantLayout />}>
        <Route index element={<Navigate to="contrato" replace />} />
        <Route path="contrato" element={<TenantContractPage />} />
        <Route path="pagos" element={<TenantPaymentsPage />} />
        <Route path="reclamos" element={<TenantReclamosPage />} />
      </Route>
    </Routes>
  );
}
