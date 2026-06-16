import { Routes, Route, Navigate } from "react-router-dom";
import { OwnerLayout } from "./components/owner-layout";
import { OwnerHomePage } from "./components/owner-home-page";
import { OwnerPropertiesPage } from "./components/owner-properties-page";
import { OwnerSettlementsPage } from "./components/owner-settlements-page";

export function OwnerPortalPage() {
  return (
    <Routes>
      <Route element={<OwnerLayout />}>
        <Route index element={<Navigate to="propiedades" replace />} />
        <Route path="propiedades" element={<OwnerPropertiesPage />} />
        <Route path="rendiciones" element={<OwnerSettlementsPage />} />
      </Route>
    </Routes>
  );
}
