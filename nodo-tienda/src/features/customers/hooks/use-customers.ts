import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { CustomerRow } from "@/shared/types/database";

export const CUSTOMERS_QK = ["nodo_tienda", "customers"] as const;

export function useCustomers() {
  const { orgId } = useAuth();
  return useQuery<CustomerRow[]>({
    queryKey: [...CUSTOMERS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .select("*")
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("last_purchase_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (
      values: Omit<CustomerRow, "id" | "org_id" | "total_spent" | "last_purchase_at" | "created_at" | "updated_at">,
    ) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .insert({ ...values, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QK }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CustomerRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QK }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("customers")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QK }),
  });
}
