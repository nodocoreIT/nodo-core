import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { advanceAdjustmentDate } from "../lib/advance-adjustment-date";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

export interface RevertRentAdjustmentInput {
  contractId: string;
  previousRentAmount: number;
  lastAdjustmentDate: string;
  adjustmentPeriodMonths: number;
}

/** Rolls back an IPC/ICL apply from this month: rent, dates, pending cuotas. */
export function useRevertRentAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      previousRentAmount,
      lastAdjustmentDate,
      adjustmentPeriodMonths,
    }: RevertRentAdjustmentInput) => {
      const { error: contractError } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update({
          rent_amount: previousRentAmount,
          last_adjustment_date: advanceAdjustmentDate(
            lastAdjustmentDate,
            -adjustmentPeriodMonths,
          ),
          next_adjustment_date: lastAdjustmentDate,
        })
        .eq("id", contractId);

      if (contractError) throw contractError;

      const { error: paymentsError } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .update({ amount: previousRentAmount })
        .eq("contract_id", contractId)
        .eq("status", "pending");

      if (paymentsError) throw paymentsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
