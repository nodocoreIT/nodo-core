import { Routes, Route, Navigate } from "react-router-dom";
import { CustomerLayout } from "./components/customer-layout";
import { MyOrdersPage } from "./components/my-orders-page";
import { MyProfilePage } from "./components/my-profile-page";

export function CustomerPortalPage() {
  return (
    <CustomerLayout>
      <Routes>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<MyOrdersPage />} />
        <Route path="profile" element={<MyProfilePage />} />
      </Routes>
    </CustomerLayout>
  );
}
