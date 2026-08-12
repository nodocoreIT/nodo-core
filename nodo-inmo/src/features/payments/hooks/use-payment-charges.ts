import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import type { Database } from "@/shared/types/database";
import { PAYMENTS_QUERY_KEY } from "./use-payments";

export type PaymentChargeRow = Database["nodo_inmo"]["Tables"]["payment_charges"]["Row"];

export const PAYMENT_CHARGES_QUERY_KEY = ["nodo_inmo", "payment_charges"] as const;

/** Fetch the per-concept charge amounts already saved for a payment (for prefill in edit mode). */
export function usePaymentCharges(paymentId: string | undefined) {
  return useQuery<PaymentChargeRow[]>({
    queryKey: [...PAYMENT_CHARGES_QUERY_KEY, paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("payment_charges")
        .select("*")
        .eq("payment_id", paymentId as string);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!paymentId,
  });
}

export interface UpsertPaymentChargesInput {
  payment_id: string;
  charges: { concept_id: string; amount: number }[];
}

/**
 * Upsert the per-concept amounts for a payment's cobro. The sync_payment_charge
 * trigger keeps payments.expenses_amount derived from these rows and mirrors
 * retained concepts into property_expenses — this mutation only writes the
 * per-concept amounts, nothing else.
 */
export function useUpsertPaymentCharges() {
  const queryClient = useQueryClient();
  const { orgId } = useAuth();

  return useMutation({
    mutationFn: async ({ payment_id, charges }: UpsertPaymentChargesInput) => {
      if (!orgId) throw new Error("No org_id — user not fully provisioned");
      if (charges.length === 0) return;

      const rows = charges.map((c) => ({
        org_id: orgId,
        payment_id,
        concept_id: c.concept_id,
        amount: c.amount,
      }));

      const { error } = await supabase
        .schema("nodo_inmo")
        .from("payment_charges")
        .upsert(rows, { onConflict: "payment_id,concept_id" });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PAYMENT_CHARGES_QUERY_KEY, variables.payment_id],
      });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
