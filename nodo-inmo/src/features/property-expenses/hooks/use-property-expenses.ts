import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";
import { PROPERTY_EXPENSES_QUERY_KEY } from "./use-create-expense";

export type PropertyExpenseRow =
  Database["nodo_inmo"]["Tables"]["property_expenses"]["Row"];

/**
 * Fetch manually-registered expenses for a given property (admin-only via
 * RLS), newest first. Excludes `type = 'concepto_contrato'` rows — those are
 * auto-generated from retained contract charges (see sync_payment_charge)
 * and aren't meant to be edited/deleted from this manual list.
 */
export function usePropertyExpenses(propertyId: string) {
  return useQuery<PropertyExpenseRow[]>({
    queryKey: [...PROPERTY_EXPENSES_QUERY_KEY, propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("property_expenses")
        .select("*")
        .eq("property_id", propertyId)
        .neq("type", "concepto_contrato")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!propertyId,
  });
}
