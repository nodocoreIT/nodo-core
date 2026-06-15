import { Routes, Route } from "react-router-dom";
import { MedicoDashboard } from "@/features/dashboard/medico-dashboard";
import { MedicoConfigPage } from "@/features/medico-config/medico-config-page";

export function MedicoPortalPage() {
  return (
    <Routes>
      <Route index element={<MedicoDashboard />} />
      <Route path="configuracion" element={<MedicoConfigPage />} />
    </Routes>
  );
}
