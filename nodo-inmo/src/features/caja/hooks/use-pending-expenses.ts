import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PendingExpenseRow = Database["nodo_inmo"]["Tables"]["property_expenses"]["Row"] & {
  property: { owner_id: string | null } | null;
};

export const PENDING_EXPENSES_QUERY_KEY = ["nodo_inmo", "pending_expenses"] as const;

/**
 * Obtiene los gastos de propiedades que deben cobrarse al propietario
 * y que aún no han sido aplicados a ninguna rendición.
 */
export function usePendingExpenses() {
  return useQuery<PendingExpenseRow[]>({
    queryKey: PENDING_EXPENSES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("property_expenses")
        .select(
          "*, property:properties!property_expenses_property_id_fkey(owner_id)",
        )
        .eq("charged_to_owner", true)
        .is("applied_settlement_id", null);

      if (error) throw error;
      return (data ?? []) as unknown as PendingExpenseRow[];
    },
  });
}
