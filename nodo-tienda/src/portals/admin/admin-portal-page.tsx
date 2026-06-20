import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./components/admin-layout";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";
import { StoreProfilePage } from "@/features/store-profile/components/store-profile-page";
import { StoreBuilderPage } from "@/features/store-builder/components/store-builder-page";
import { CategoriesPage } from "@/features/categories/components/categories-page";
import { BrandsPage } from "@/features/brands/components/brands-page";
import { ProductsPage } from "@/features/products/components/products-page";
import { InventoryPage } from "@/features/inventory/components/inventory-page";
import { CustomersPage } from "@/features/customers/components/customers-page";
import { SuppliersPage } from "@/features/suppliers/components/suppliers-page";
import { OrdersPage } from "@/features/orders/components/orders-page";
import { PaymentsPage } from "@/features/payments/components/payments-page";
import { PlanGate } from "@/shared/components/plan-gate";

export function AdminPortalPage() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* Default → dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route
          path="store-builder"
          element={
            <PlanGate requiredPlan="pro" fullPage>
              <StoreBuilderPage />
            </PlanGate>
          }
        />
        <Route path="store-profile" element={<StoreProfilePage />} />
      </Route>
    </Routes>
  );
}
