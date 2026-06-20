import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";

export interface DashboardStats {
  ordersToday: number;
  ordersPending: number;
  revenueThisMonth: number;
  newCustomersThisMonth: number;
  lowStockItems: number;
  totalProducts: number;
}

const LOW_STOCK_THRESHOLD = 5;

export function useDashboardStats() {
  const { orgId } = useAuth();

  return useQuery<DashboardStats>({
    queryKey: ["nodo_tienda", "dashboard_stats", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No orgId");

      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();

      const [todayOrders, pendingOrders, monthOrders, newCustomers, lowStock, totalProducts] =
        await Promise.all([
          // Orders today
          supabase
            .schema("nodo_tienda")
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .gte("created_at", startOfToday)
            .is("deleted_at", null),
          // Pending orders
          supabase
            .schema("nodo_tienda")
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .eq("status", "pending")
            .is("deleted_at", null),
          // Revenue this month (sum of active orders)
          supabase
            .schema("nodo_tienda")
            .from("orders")
            .select("total")
            .eq("org_id", orgId)
            .in("status", ["confirmed", "preparing", "shipped", "delivered"])
            .gte("created_at", startOfMonth)
            .is("deleted_at", null),
          // New customers this month
          supabase
            .schema("nodo_tienda")
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .gte("created_at", startOfMonth)
            .is("deleted_at", null),
          // Low stock items (quantity <= threshold)
          supabase
            .schema("nodo_tienda")
            .from("inventory")
            .select("id, quantity")
            .eq("org_id", orgId)
            .lte("quantity", LOW_STOCK_THRESHOLD),
          // Total active products
          supabase
            .schema("nodo_tienda")
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .eq("is_active", true)
            .is("deleted_at", null),
        ]);

      if (todayOrders.error) throw todayOrders.error;
      if (pendingOrders.error) throw pendingOrders.error;
      if (monthOrders.error) throw monthOrders.error;
      if (newCustomers.error) throw newCustomers.error;
      if (lowStock.error) throw lowStock.error;
      if (totalProducts.error) throw totalProducts.error;

      const revenue = (monthOrders.data ?? []).reduce(
        (sum, o) => sum + (o.total ?? 0),
        0,
      );

      return {
        ordersToday: todayOrders.count ?? 0,
        ordersPending: pendingOrders.count ?? 0,
        revenueThisMonth: revenue,
        newCustomersThisMonth: newCustomers.count ?? 0,
        lowStockItems: lowStock.data?.length ?? 0,
        totalProducts: totalProducts.count ?? 0,
      };
    },
    enabled: !!orgId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRecentOrders() {
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["nodo_tienda", "recent_orders", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("orders")
        .select("*, customer:customers(id, first_name, last_name)")
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
