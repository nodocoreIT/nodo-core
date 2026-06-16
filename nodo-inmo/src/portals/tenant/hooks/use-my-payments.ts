import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type PaymentRow = Database["nodo_inmo"]["Tables"]["payments"]["Row"];

export type MyPaymentWithRelations = PaymentRow & {
  contract: {
    property: {
      address: string;
    } | null;
  } | null;
};

export const MY_PAYMENTS_QUERY_KEY = ["nodo_inmo", "my-payments"] as const;

/**
 * Fetch all payments for the authenticated tenant.
 * RLS already scopes these to contracts where tenant_id matches the tenant's
 * contact row. Embeds the property address for display.
 */
export function useMyPayments() {
  return useQuery<MyPaymentWithRelations[]>({
    queryKey: MY_PAYMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .select(
          "*, contract:contracts!payments_contract_id_fkey(" +
            "property:properties!contracts_property_id_fkey(address)" +
          ")",
        )
        .order("due_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as MyPaymentWithRelations[];
    },
  });
}
