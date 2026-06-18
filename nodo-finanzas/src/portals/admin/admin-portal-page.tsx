import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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

const LEGACY_PATHS = [
  "dashboard",
  "gastos-diarios",
  "gastos-fijos",
  "tarjetas",
  "prestamos",
  "planes-ahorro",
  "saldos",
  "informe-mensual",
  "configuracion",
] as const;

/** Redirects /dashboard → /admin/dashboard (legacy URLs without the admin prefix). */
function LegacyAdminRedirect() {
  const { pathname } = useLocation();
  const sub = pathname.replace(/^\//, "");
  return <Navigate to={`/admin/${sub}`} replace />;
}

export function AdminPortalPage() {
  return (
    <Routes>
      <Route path="admin" element={<AdminLayout />}>
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

      {LEGACY_PATHS.map((segment) => (
        <Route key={segment} path={segment} element={<LegacyAdminRedirect />} />
      ))}
      <Route path={`${LEGACY_PATHS[3]}/:id`} element={<LegacyAdminRedirect />} />

      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
