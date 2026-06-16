import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export type OwnerSettlementStatus = "pending" | "settled";

export type OwnerSettlement = {
  id: string;
  owner_id: string;
  payment_id: string | null;
  amount: number;
  currency: string;
  status: OwnerSettlementStatus;
  settled_date: string | null;
  breakdown: Record<string, unknown> | null;
  created_at: string;
  payment: {
    due_date: string;
    amount: number;
    contract: {
      property: {
        address: string;
      } | null;
    } | null;
  } | null;
};

export const MY_SETTLEMENTS_QUERY_KEY = ["nodo_inmo", "my-settlements"] as const;

/**
 * Fetch all owner_settlements for the current portal user, enriched with
 * the related payment's due_date and property address.
 * RLS scopes rows to the authenticated owner's contact.
 */
export function useMySettlements() {
  return useQuery<OwnerSettlement[]>({
    queryKey: MY_SETTLEMENTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("owner_settlements")
        .select(
          "*, payment:payments!owner_settlements_payment_id_fkey(due_date, amount, contract:contracts!payments_contract_id_fkey(property:properties!contracts_property_id_fkey(address)))",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as OwnerSettlement[];
    },
  });
}
