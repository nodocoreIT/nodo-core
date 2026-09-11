import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { PAYMENTS_QUERY_KEY } from "@/features/payments/hooks/use-payments";
import { advanceAdjustmentDate } from "../lib/advance-adjustment-date";
import { CONTRACTS_QUERY_KEY } from "./use-contracts";

export interface ApplyRentAdjustmentInput {
  contractId: string;
  newRentAmount: number;
  adjustmentPeriodMonths: number;
}

function firstDayOfMonth(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

/**
 * Applies an IPC/ICL rent adjustment using the current month's single-step
 * rate (never accumulated). Rolls last_adjustment_date to the current month
 * and next_adjustment_date forward by the contract's period, then syncs the
 * new amount onto every pending (unpaid) installment — mirrors the "keep
 * pending installments aligned with rent" step in sync-contract-installments.ts.
 */
export function useApplyRentAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      newRentAmount,
      adjustmentPeriodMonths,
    }: ApplyRentAdjustmentInput) => {
      const appliedDate = firstDayOfMonth(new Date());
      const nextAdjustmentDate = advanceAdjustmentDate(appliedDate, adjustmentPeriodMonths);

      const { error: contractError } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .update({
          rent_amount: newRentAmount,
          last_adjustment_date: appliedDate,
          next_adjustment_date: nextAdjustmentDate,
        })
        .eq("id", contractId);

      if (contractError) throw contractError;

      const { error: paymentsError } = await supabase
        .schema("nodo_inmo")
        .from("payments")
        .update({ amount: newRentAmount })
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
