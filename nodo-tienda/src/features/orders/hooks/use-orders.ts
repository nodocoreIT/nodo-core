import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { OrderRow, OrderItemRow, OrderStatusHistoryRow, CustomerRow } from "@/shared/types/database";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderWithCustomer = OrderRow & {
  customer: Pick<CustomerRow, "id" | "first_name" | "last_name"> | null;
  items_count: number;
};

export type OrderDetail = OrderRow & {
  customer: Pick<CustomerRow, "id" | "first_name" | "last_name" | "email" | "phone"> | null;
  order_items: OrderItemRow[];
  order_status_history: OrderStatusHistoryRow[];
};

export function useOrders(filters?: { status?: OrderStatus }) {
  const { orgId } = useAuth();

  return useQuery<OrderWithCustomer[]>({
    queryKey: ["nodo_tienda", "orders", orgId, filters],
    queryFn: async () => {
      let q = supabase
        .schema("nodo_tienda")
        .from("orders")
        .select(`*, customer:customers(id, first_name, last_name), order_items(id)`)
        .eq("org_id", orgId!)
        .is("deleted_at" as never, null)
        .order("created_at", { ascending: false });

      if (filters?.status) {
        q = q.eq("status", filters.status);
      }

      const { data, error } = await q;
      if (error) throw error;

      return ((data ?? []) as (OrderRow & {
        customer: Pick<CustomerRow, "id" | "first_name" | "last_name"> | null;
        order_items: { id: string }[];
      })[]).map((row) => ({
        ...row,
        items_count: row.order_items?.length ?? 0,
        order_items: undefined,
      })) as OrderWithCustomer[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useOrder(orderId: string | null) {
  const { orgId } = useAuth();

  return useQuery<OrderDetail>({
    queryKey: ["nodo_tienda", "order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("orders")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone),
          order_items(*),
          order_status_history(*)
        `)
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data as OrderDetail;
    },
    enabled: !!orderId && !!orgId,
  });
}

export function useCreateOrder() {
  const { orgId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      order: Omit<OrderRow, "id" | "org_id" | "created_at" | "updated_at">;
      items: Omit<OrderItemRow, "id" | "org_id" | "order_id" | "created_at">[];
    }) => {
      const { data: order, error: orderErr } = await supabase
        .schema("nodo_tienda")
        .from("orders")
        .insert({ ...params.order, org_id: orgId! })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const items = params.items.map((item) => ({
        ...item,
        order_id: order.id,
        org_id: orgId!,
      }));

      const { error: itemsErr } = await supabase
        .schema("nodo_tienda")
        .from("order_items")
        .insert(items);
      if (itemsErr) throw itemsErr;

      return order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "orders"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      notes,
    }: {
      orderId: string;
      status: OrderStatus;
      notes?: string;
    }) => {
      const { error: updateErr } = await supabase
        .schema("nodo_tienda")
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (updateErr) throw updateErr;

      const { error: histErr } = await supabase
        .schema("nodo_tienda")
        .from("order_status_history")
        .insert({ order_id: orderId, status, notes: notes ?? null });
      if (histErr) throw histErr;
    },
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "orders"] });
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "order", orderId] });
    },
  });
}
