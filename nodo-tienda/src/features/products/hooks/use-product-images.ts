import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { ProductImageRow } from "@/shared/types/database";

const IMAGES_QK = (productId: string | null) =>
  ["nodo_tienda", "product_images", productId] as const;

export function useProductImages(productId: string | null) {
  return useQuery<ProductImageRow[]>({
    queryKey: IMAGES_QK(productId),
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("product_images")
        .select("*")
        .eq("product_id", productId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!productId,
    staleTime: 60_000,
  });
}

export function useAddProductImage() {
  const qc = useQueryClient();
  const { orgId } = useAuth();
  return useMutation({
    mutationFn: async (values: {
      product_id: string;
      url: string;
      alt?: string | null;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("product_images")
        .insert({ ...values, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: IMAGES_QK(variables.product_id) });
    },
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      productId,
    }: {
      id: string;
      productId: string;
    }) => {
      const { error } = await supabase
        .schema("nodo_tienda")
        .from("product_images")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      qc.invalidateQueries({ queryKey: IMAGES_QK(productId) });
    },
  });
}
