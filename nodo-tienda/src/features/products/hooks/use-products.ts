import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { ProductRow } from "@/shared/types/database";

export const PRODUCTS_QK = ["nodo_tienda", "products"] as const;

export type ProductWithRefs = ProductRow & {
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
};

export function useProducts() {
  const { orgId } = useAuth();
  return useQuery<ProductWithRefs[]>({
    queryKey: [...PRODUCTS_QK, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("products")
        .select(`
          *,
          category:categories(id, name),
          brand:brands(id, name)
        `)
        .eq("org_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductWithRefs[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      sku?: string | null;
      description?: string | null;
      category_id?: string | null;
      brand_id?: string | null;
      price: number;
      promotional_price?: number | null;
      cost?: number | null;
      is_active: boolean;
      is_featured: boolean;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("products")
        .insert({ ...values, org_id: orgId!, has_variants: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QK }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<ProductRow> & { id: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("products")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QK }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("products")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCTS_QK }),
  });
}
