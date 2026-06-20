import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { SupplierRow } from "@/shared/types/database";

export const SUPPLIERS_QK = ["nodo_tienda", "suppliers"] as const;

export function useSuppliers() {
  const { orgId } = useAuth();
  return useQuery<SupplierRow[]>({
    queryKey: [...SUPPLIERS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("suppliers")
        .select("*")
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (
      values: Omit<SupplierRow, "id" | "org_id" | "created_at" | "updated_at">,
    ) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("suppliers")
        .insert({ ...values, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_QK }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<SupplierRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("suppliers")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_QK }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("suppliers")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_QK }),
  });
}
