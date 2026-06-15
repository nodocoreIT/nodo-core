import { Routes, Route, Navigate } from "react-router-dom";
import { MedicoLayout } from "./components/medico-layout";
import { MedicoDashboard } from "@/features/dashboard/medico-dashboard";
import { MedicoConfigPage } from "@/features/medico-config/medico-config-page";
import { PacientesPage } from "@/features/paciente/pacientes-page";
import { AgendaPage } from "@/features/agenda/agenda-page";
import { RecetasPage } from "@/features/medical/recetas-page";

export function MedicoPortalPage() {
  return (
    <Routes>
      <Route element={<MedicoLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<MedicoDashboard />} />
        <Route path="pacientes" element={<PacientesPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="recetas" element={<RecetasPage />} />
        <Route path="configuracion" element={<MedicoConfigPage />} />
      </Route>
    </Routes>
  );
}
