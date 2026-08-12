import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import type { Database } from "@/shared/types/database";

export type ContractChargeConceptRow =
  Database["nodo_inmo"]["Tables"]["contract_charge_concepts"]["Row"];

export const CONTRACT_CHARGE_CONCEPTS_QUERY_KEY = [
  "nodo_inmo",
  "contract_charge_concepts",
] as const;

/** Fetch the active charge concepts configured for a contract, in display order. */
export function useContractChargeConcepts(contractId: string | undefined) {
  return useQuery<ContractChargeConceptRow[]>({
    queryKey: [...CONTRACT_CHARGE_CONCEPTS_QUERY_KEY, contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contract_charge_concepts")
        .select("*")
        .eq("contract_id", contractId as string)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contractId,
  });
}
