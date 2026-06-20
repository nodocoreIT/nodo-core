import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { ProductVariantRow } from "@/shared/types/database";

export type VariantRow = ProductVariantRow;

const VARIANTS_QK = (productId: string | null) =>
  ["nodo_tienda", "product_variants", productId] as const;

export function useProductVariants(productId: string | null) {
  return useQuery<VariantRow[]>({
    queryKey: VARIANTS_QK(productId),
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 60_000,
  });
}

export function useCreateVariant() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      product_id: string;
      sku?: string | null;
      attributes: Record<string, unknown>;
      price_override?: number | null;
      cost_override?: number | null;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("product_variants")
        .insert({ ...values, org_id: orgId!, is_active: values.is_active ?? true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: VARIANTS_QK(variables.product_id) });
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      productId,
      ...values
    }: Partial<VariantRow> & { id: string; productId: string }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("product_variants")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data, productId };
    },
    onSuccess: ({ productId }) => {
      qc.invalidateQueries({ queryKey: VARIANTS_QK(productId) });
    },
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("product_variants")
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      qc.invalidateQueries({ queryKey: VARIANTS_QK(productId) });
    },
  });
}
