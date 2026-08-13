import { supabase } from "@/shared/lib/supabase";
import { generateInstallments } from "./generate-installments";

export interface SyncInstallmentsContract {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  status: string;
}

export interface SyncInstallmentsConcept {
  id: string;
  default_amount: number | null;
}

/**
 * Generate missing monthly installments for an active contract.
 * Idempotent: existing (contract_id, period) rows are left unchanged.
 *
 * Charge concepts with a `default_amount` (e.g. "Expensas", usually a fixed
 * monthly cost) are pre-seeded into `payment_charges` for every pending
 * installment — the sync_payment_charge trigger derives
 * `payments.expenses_amount` from those rows. Concepts without a default
 * amount are left for the user to fill in at collection time.
 */
export async function syncContractInstallments(
  orgId: string,
  contract: SyncInstallmentsContract,
  concepts: SyncInstallmentsConcept[] = [],
  fromDate?: string,
): Promise<{ inserted: number }> {
  if (contract.status !== "active") return { inserted: 0 };
  if (!contract.start_date || !contract.end_date || !contract.rent_amount) {
    return { inserted: 0 };
  }

  const drafts = generateInstallments({
    start_date: contract.start_date,
    end_date: contract.end_date,
    rent_amount: contract.rent_amount,
    currency: contract.currency,
    from_date: fromDate,
  });

  if (drafts.length > 0) {
    const rows = drafts.map((d) => ({
      org_id: orgId,
      contract_id: contract.id,
      period: d.period,
      due_date: d.due_date,
      amount: d.amount,
      currency: d.currency,
      status: d.status,
    }));

    const { error } = await supabase
      .schema("nodo_inmo")
      .from("payments")
      .upsert(rows, { onConflict: "contract_id,period", ignoreDuplicates: true });

    if (error) throw error;
  }

  // Keep pending installments aligned with the current contract rent.
  const { error: syncError } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .update({ amount: contract.rent_amount })
    .eq("contract_id", contract.id)
    .eq("status", "pending");

  if (syncError) throw syncError;

  // Seed/keep default charge amounts (e.g. Expensas) on every pending
  // installment — mirrors the rent-sync above.
  const defaultConcepts = concepts.filter((c) => c.default_amount != null);
  if (defaultConcepts.length > 0) {
    const { data: pendingPayments, error: pendingError } = await supabase
      .schema("nodo_inmo")
      .from("payments")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("status", "pending");

    if (pendingError) throw pendingError;

    if (pendingPayments && pendingPayments.length > 0) {
      const chargeRows = pendingPayments.flatMap((p) =>
        defaultConcepts.map((c) => ({
          org_id: orgId,
          payment_id: p.id,
          concept_id: c.id,
          amount: c.default_amount as number,
        })),
      );

      const { error: chargesError } = await supabase
        .schema("nodo_inmo")
        .from("payment_charges")
        .upsert(chargeRows, { onConflict: "payment_id,concept_id" });

      if (chargesError) throw chargesError;
    }
  }

  return { inserted: drafts.length };
}
