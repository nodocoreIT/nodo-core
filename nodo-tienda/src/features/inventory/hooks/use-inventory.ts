import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { InventoryRow, ProductRow, ProductVariantRow } from "@/shared/types/database";

export type InventoryWithProduct = InventoryRow & {
  product: Pick<ProductRow, "id" | "name" | "sku"> | null;
  variant: { id: string; attributes: Record<string, string> } | null;
  available_quantity: number;
};

export function useInventory() {
  const { orgId } = useAuth();

  return useQuery<InventoryWithProduct[]>({
    queryKey: ["nodo_tienda", "inventory", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("inventory")
        .select(`
          *,
          product:products(id, name, sku),
          variant:product_variants(id, attributes)
        `)
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return ((data ?? []) as (InventoryRow & {
        product: Pick<ProductRow, "id" | "name" | "sku"> | null;
        variant: Pick<ProductVariantRow, "id" | "attributes"> | null;
      })[]).map((row) => ({
        ...row,
        variant: row.variant
          ? (row.variant as { id: string; attributes: Record<string, string> })
          : null,
        available_quantity: (row.quantity ?? 0) - (row.reserved_quantity ?? 0),
      })) as InventoryWithProduct[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useInventoryMovements(productId: string | null) {
  return useQuery({
    queryKey: ["nodo_tienda", "inventory_movements", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("inventory_movements")
        .select("*")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdjustInventory() {
  const { orgId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      inventoryId: string;
      productId: string;
      delta: number;
      reason: string;
    }) => {
      const { data: current, error: fetchErr } = await supabase
        .schema("nodo_tienda")
        .from("inventory")
        .select("quantity")
        .eq("id", params.inventoryId)
        .single();
      if (fetchErr) throw fetchErr;

      const newQty = Math.max(0, (current?.quantity ?? 0) + params.delta);

      const { error: updateErr } = await supabase
        .schema("nodo_tienda")
        .from("inventory")
        .update({ quantity: newQty })
        .eq("id", params.inventoryId);
      if (updateErr) throw updateErr;

      const { error: movErr } = await supabase
        .schema("nodo_tienda")
        .from("inventory_movements")
        .insert({
          org_id: orgId!,
          product_id: params.productId,
          type: params.delta > 0 ? "in" : "out",
          quantity: Math.abs(params.delta),
          reason: params.reason,
        });
      if (movErr) throw movErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "inventory"] });
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "inventory_movements"] });
    },
  });
}
