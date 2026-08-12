import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { Database } from "@/shared/types/database";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

type ContractInsert = Database["nodo_inmo"]["Tables"]["contracts"]["Insert"];

export interface ChargeConceptInput {
  label: string;
  retained_by_agency: boolean;
  default_amount?: number | null;
}

export type CreateContractInput = Omit<ContractInsert, "org_id"> & {
  /** Contact ids playing the guarantor role on this contract. */
  guarantor_ids?: string[];
  /** Charge concepts to create for this contract (e.g. "Municipal", "Expensas"). */
  charge_concepts?: ChargeConceptInput[];
};

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({
      guarantor_ids = [],
      charge_concepts = [],
      ...fields
    }: CreateContractInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");

      const { data: contract, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .insert({ ...fields, org_id: orgId })
        .select()
        .single();

      if (error) throw error;

      if (guarantor_ids.length > 0) {
        const links = guarantor_ids.map((guarantor_id) => ({
          org_id: orgId,
          contract_id: contract.id,
          guarantor_id,
        }));

        const { error: linkError } = await supabase
          .schema("nodo_inmo")
          .from("contract_guarantors")
          .insert(links);

        if (linkError) throw linkError;
      }

      if (charge_concepts.length > 0) {
        const concepts = charge_concepts.map((cc, index) => ({
          org_id: orgId,
          contract_id: contract.id,
          label: cc.label,
          retained_by_agency: cc.retained_by_agency,
          default_amount: cc.default_amount ?? null,
          sort_order: index,
        }));

        const { error: conceptsError } = await supabase
          .schema("nodo_inmo")
          .from("contract_charge_concepts")
          .insert(concepts);

        if (conceptsError) throw conceptsError;
      }

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
    },
  });
}
