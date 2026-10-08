import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { currentMonthKeyFromDate, generateInstallments } from "../lib/generate-installments";
import { PAYMENTS_QUERY_KEY, usePayments } from "./use-payments";

/** First day of the month after a 'YYYY-MM-DD' period. */
function nextMonthStart(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Keeps every active contract's installments up to the current month, so
 * "Cobros del mes" and the past-month debts never depend on someone running
 * "Generar pagos" by hand.
 *
 * Generates from the month after the contract's latest existing installment
 * through the current month, so months skipped while the app wasn't opened
 * still show up as unpaid. Contracts with no installments at all start at the
 * current month (history is the user's choice via "Generar pagos"). Earlier
 * gaps, e.g. deliberately deleted cuotas, are never recreated, and existing
 * installments are untouched (the upsert ignores duplicates).
 */
export function useAutoGenerateInstallments() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const contracts = useContracts();
  const payments = usePayments();
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!orgId || !contracts.data || !payments.data) return;

    const monthKey = currentMonthKeyFromDate(new Date());
    const fallbackFrom = `${monthKey}-01`;
    const latestPeriod = new Map<string, string>();
    for (const p of payments.data) {
      const prev = latestPeriod.get(p.contract_id);
      if (!prev || p.period > prev) latestPeriod.set(p.contract_id, p.period);
    }

    const missing: { contract: (typeof contracts.data)[number]; from: string }[] = [];
    for (const c of contracts.data) {
      if (c.status !== "active" || c.archived_at) continue;
      if (!c.start_date || !c.end_date || !c.rent_amount) continue;
      if (attempted.current.has(`${c.id}:${monthKey}`)) continue;

      const latest = latestPeriod.get(c.id);
      const from = latest ? nextMonthStart(latest) : fallbackFrom;
      if (from.slice(0, 7) > monthKey) continue;

      const drafts = generateInstallments({
        start_date: c.start_date,
        end_date: c.end_date,
        rent_amount: c.rent_amount,
        currency: c.currency,
        from_date: from,
      });
      if (drafts.length > 0) missing.push({ contract: c, from });
    }
    if (missing.length === 0) return;

    for (const { contract } of missing) attempted.current.add(`${contract.id}:${monthKey}`);

    void Promise.allSettled(
      missing.map(({ contract: c, from }) =>
        syncContractInstallments(
          orgId,
          c,
          c.charge_concepts.map((cc) => ({ id: cc.id, default_amount: cc.default_amount })),
          from,
        ),
      ),
    ).then(() => queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }));
  }, [orgId, contracts.data, payments.data, queryClient]);
}
