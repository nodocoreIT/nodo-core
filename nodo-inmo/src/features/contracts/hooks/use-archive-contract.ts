import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";

/**
 * Archive a contract: mark terminated, cancel pending cuotas, clear pending rendiciones.
 * Paid history is retained in the database.
 */
export function useArchiveContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.schema("nodo_inmo").rpc("archive_contract", {
        p_contract_id: id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["nodo_inmo", "owner_settlements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
