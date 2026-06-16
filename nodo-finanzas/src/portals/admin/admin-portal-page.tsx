import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { GastosDiariosPage } from "@/features/gastos-diarios/gastos-diarios-page";
import { GastosFijosPage } from "@/features/gastos-fijos/gastos-fijos-page";
import { TarjetasPage } from "@/features/tarjetas/tarjetas-page";
import { DetalleTarjetaPage } from "@/features/tarjetas/detalle-tarjeta-page";
import { PrestamosPage } from "@/features/prestamos/prestamos-page";
import { PlanesAhorroPage } from "@/features/planes-ahorro/planes-ahorro-page";
import { SaldosPage } from "@/features/saldos/saldos-page";
import { InformeMensualPage } from "@/features/informe-mensual/informe-mensual-page";
import { ConfiguracionPage } from "@/features/configuracion/configuracion-page";

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="gastos-diarios" element={<GastosDiariosPage />} />
        <Route path="gastos-fijos" element={<GastosFijosPage />} />
        <Route path="tarjetas" element={<TarjetasPage />} />
        <Route path="tarjetas/:id" element={<DetalleTarjetaPage />} />
        <Route path="prestamos" element={<PrestamosPage />} />
        <Route path="planes-ahorro" element={<PlanesAhorroPage />} />
        <Route path="saldos" element={<SaldosPage />} />
        <Route path="informe-mensual" element={<InformeMensualPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>
    </Routes>
  );
}
