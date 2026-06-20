import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { CategoryRow } from "@/shared/types/database";

export const CATEGORIES_QK = ["nodo_tienda", "categories"] as const;

export function useCategories() {
  const { orgId } = useAuth();
  return useQuery<CategoryRow[]>({
    queryKey: [...CATEGORIES_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("categories")
        .select("*")
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      description?: string | null;
      parent_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("categories")
        .insert({ ...values, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_QK }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<CategoryRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("categories")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_QK }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("categories")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_QK }),
  });
}
