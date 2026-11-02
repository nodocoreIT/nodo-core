import { supabase } from "@/shared/lib/supabase";
import { currentMonthKeyFromDate, generateInstallments } from "./generate-installments";
import {
  adjustmentWindowSize,
  rollAdjustmentDatesIfStale,
  stickyPactadoRent,
} from "./sticky-pactado-rent";

export interface SyncInstallmentsContract {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  currency: string;
  status: string;
  last_adjustment_date?: string | null;
  next_adjustment_date?: string | null;
  adjustment_period_months?: number | null;
}

export interface SyncInstallmentsConcept {
  id: string;
  default_amount: number | null;
}

/**
 * Generate missing monthly installments for an active contract.
 * Idempotent: existing (contract_id, period) rows are not replaced on insert.
 *
 * New months keep the last IPC/ICL alquiler (sticky) until the next adjustment
 * date. Pending cuotas from that increased period forward are aligned up to
 * that amount; they are never auto-decreased here (apply / edit contract do that).
 *
 * Charge concepts with a `default_amount` (e.g. "Expensas") are pre-seeded into
 * `payment_charges` for every pending installment.
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

  const windowSize = adjustmentWindowSize(contract.adjustment_period_months);
  const { data: recent, error: recentError } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .select("period, amount")
    .eq("contract_id", contract.id)
    .order("period", { ascending: false })
    .limit(windowSize);

  if (recentError) throw recentError;

  const windowRows = recent ?? [];
  const { pactado, sourceAmount } = stickyPactadoRent(
    contract.rent_amount,
    windowRows.map((row) => Number(row.amount)),
  );
  const increasedPeriod =
    sourceAmount != null
      ? windowRows
          .filter((row) => Math.round(Number(row.amount)) === sourceAmount)
          .map((row) => row.period)
          .sort()[0]
      : null;

  const drafts = generateInstallments({
    start_date: contract.start_date,
    end_date: contract.end_date,
    rent_amount: pactado,
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

  if (pactado > Math.round(contract.rent_amount)) {
    const todayMonth = currentMonthKeyFromDate(new Date());
    const rolled =
      increasedPeriod != null
        ? rollAdjustmentDatesIfStale({
            lastAdjustmentDate: contract.last_adjustment_date,
            nextAdjustmentDate: contract.next_adjustment_date,
            periodMonths: windowSize,
            increasedPeriod,
            todayMonth,
          })
        : null;
    const { error: healError } = await supabase
      .schema("nodo_inmo")
      .from("contracts")
      .update({
        rent_amount: pactado,
        ...(rolled ?? {}),
      })
      .eq("id", contract.id);

    if (healError) throw healError;
  }

  // Align pending cuotas from the increased period forward — never drop them
  // back to a stale contract.rent_amount.
  const floorPeriod =
    increasedPeriod ??
    windowRows[0]?.period ??
    fromDate ??
    `${contract.start_date.slice(0, 7)}-01`;
  const { error: syncError } = await supabase
    .schema("nodo_inmo")
    .from("payments")
    .update({ amount: pactado })
    .eq("contract_id", contract.id)
    .eq("status", "pending")
    .gte("period", floorPeriod);

  if (syncError) throw syncError;

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
