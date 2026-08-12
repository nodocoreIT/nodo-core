import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { Database } from "@/shared/types/database";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { CASH_MOVEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-cash-movements";
import { OWNER_SETTLEMENTS_QUERY_KEY } from "@/features/caja/hooks/use-owner-settlements";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";
import { CONTRACT_CHARGE_CONCEPTS_QUERY_KEY } from "./use-contract-charge-concepts";

type ContractUpdate = Database["nodo_inmo"]["Tables"]["contracts"]["Update"];

export interface ChargeConceptUpdateInput {
  /** Present for an existing concept being edited; absent for a new one. */
  id?: string;
  label: string;
  retained_by_agency: boolean;
  default_amount?: number | null;
}

export type UpdateContractInput = Omit<ContractUpdate, "org_id"> & {
  id: string;
  /** Full desired set of guarantor contact ids; links are reconciled to match. */
  guarantor_ids?: string[];
  /**
   * Full desired set of charge concepts; reconciled by diff against what's
   * currently active on the contract — never delete-all+reinsert, because
   * payment_charges references concept_id with on delete restrict. Removed
   * concepts are soft-deleted (active=false) to preserve history.
   */
  charge_concepts?: ChargeConceptUpdateInput[];
};

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      guarantor_ids,
      charge_concepts,
      ...fields
    }: UpdateContractInput) => {
      const { error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update(fields)
        .eq("id", id);

      if (error) throw error;

      // Reconcile guarantor links: clear the contract's links, then re-insert
      // the desired set. Simple and correct for the volumes involved.
      if (guarantor_ids) {
        const { error: delError } = await supabase
          .schema("nodo_inmo")
          .from("contract_guarantors")
          .delete()
          .eq("contract_id", id);

        if (delError) throw delError;

        if (guarantor_ids.length > 0 && orgId) {
          const links = guarantor_ids.map((guarantor_id) => ({
            org_id: orgId,
            contract_id: id,
            guarantor_id,
          }));

          const { error: insError } = await supabase
            .schema("nodo_inmo")
            .from("contract_guarantors")
            .insert(links);

          if (insError) throw insError;
        }
      }

      // Reconcile charge concepts by diff: update existing rows, insert new
      // ones, soft-delete removed ones. Never a hard delete — a concept may
      // already have payment_charges pointing at it.
      if (charge_concepts && orgId) {
        const { data: existing, error: existingError } = await supabase
          .schema("nodo_inmo")
          .from("contract_charge_concepts")
          .select("id")
          .eq("contract_id", id)
          .eq("active", true);

        if (existingError) throw existingError;

        const keptIds = new Set(
          charge_concepts.filter((cc) => cc.id).map((cc) => cc.id as string),
        );
        const removedIds = (existing ?? [])
          .map((row) => row.id)
          .filter((existingId) => !keptIds.has(existingId));

        if (removedIds.length > 0) {
          const { error: archiveError } = await supabase
            .schema("nodo_inmo")
            .from("contract_charge_concepts")
            .update({ active: false })
            .in("id", removedIds);

          if (archiveError) throw archiveError;
        }

        for (const [index, cc] of charge_concepts.entries()) {
          if (cc.id) {
            const { error: updateError } = await supabase
              .schema("nodo_inmo")
              .from("contract_charge_concepts")
              .update({
                label: cc.label,
                retained_by_agency: cc.retained_by_agency,
                default_amount: cc.default_amount ?? null,
                sort_order: index,
              })
              .eq("id", cc.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .schema("nodo_inmo")
              .from("contract_charge_concepts")
              .insert({
                org_id: orgId,
                contract_id: id,
                label: cc.label,
                retained_by_agency: cc.retained_by_agency,
                default_amount: cc.default_amount ?? null,
                sort_order: index,
              });

            if (insertError) throw insertError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: OWNER_SETTLEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CONTRACT_CHARGE_CONCEPTS_QUERY_KEY });
    },
  });
}
