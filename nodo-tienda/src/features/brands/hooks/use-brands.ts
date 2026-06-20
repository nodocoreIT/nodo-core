import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { BrandRow } from "@/shared/types/database";

export const BRANDS_QK = ["nodo_tienda", "brands"] as const;

export function useBrands() {
  const { orgId } = useAuth();
  return useQuery<BrandRow[]>({
    queryKey: [...BRANDS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("brands")
        .select("*")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      description?: string | null;
      logo_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("brands")
        .insert({ ...values, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_QK }),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<BrandRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("brands")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_QK }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("brands")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDS_QK }),
  });
}
