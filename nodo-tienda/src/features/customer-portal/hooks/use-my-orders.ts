import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { OrderRow, OrderItemRow, CustomerRow } from "@/shared/types/database";

type OrderWithItems = OrderRow & {
  order_items: Pick<OrderItemRow, "id" | "product_name" | "variant_label" | "quantity" | "unit_price">[];
};

export function useMyOrders() {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ["nodo_tienda", "my_orders", user?.email],
    queryFn: async (): Promise<OrderWithItems[]> => {
      if (!user?.email || !orgId) return [];

      // First find the customer record by email
      const { data: customer } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", user.email)
        .maybeSingle();

      if (!customer) return [];

      // Then fetch their orders
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("orders")
        .select(`
          id, org_id, order_number, customer_id, status, subtotal, discount,
          shipping_cost, tax, total, shipping_address, notes, created_at, updated_at,
          order_items(id, product_name, variant_label, quantity, unit_price)
        `)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as OrderWithItems[];
    },
    enabled: !!user?.email && !!orgId,
    staleTime: 30_000,
  });
}

export function useMyProfile() {
  const { user, orgId } = useAuth();
  return useQuery({
    queryKey: ["nodo_tienda", "my_customer", user?.email],
    queryFn: async (): Promise<CustomerRow | null> => {
      if (!user?.email || !orgId) return null;
      const { data } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .select("*")
        .eq("org_id", orgId)
        .eq("email", user.email)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user?.email && !!orgId,
    staleTime: 60_000,
  });
}
