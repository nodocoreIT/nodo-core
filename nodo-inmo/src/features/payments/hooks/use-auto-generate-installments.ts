import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { CONTRACTS_QUERY_KEY, useContracts } from "@/features/contracts/hooks/use-contracts";
import { syncContractInstallments } from "@/features/payments/lib/sync-contract-installments";
import { currentMonthKeyFromDate } from "../lib/generate-installments";
import { PAYMENTS_QUERY_KEY, usePayments } from "./use-payments";
import { useIPCHistory } from "@/features/ipc/hooks/use-ipc-history";
import { useICLHistory } from "@/features/ipc/hooks/use-icl-history";
import {
  computeAccumulatedIclAdjustment,
  computeAccumulatedIpcAdjustment,
} from "@/features/ipc/lib/accumulated-adjustment";
import {
  shouldRestoreIndexRent,
  stickyPactadoRent,
} from "../lib/sticky-pactado-rent";
import { supabase } from "@/shared/lib/supabase";

/** First day of the month after a 'YYYY-MM-DD' period. */
function nextMonthStart(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function cuotaAmount(p: { amount: number; paid_amount?: number | null }): number {
  return Math.max(Math.round(p.amount), Math.round(p.paid_amount ?? 0));
}

/**
 * Keeps every active contract's installments up to the current month, so
 * "Cobros del mes" and the past-month debts never depend on someone running
 * "Generar pagos" by hand.
 *
 * Also restores IPC/ICL rent when last/next dates were rolled but the pactado
 * was overwritten back to the pre-increase amount, and realigns this month's
 * pending cuota even if it already existed.
 */
export function useAutoGenerateInstallments() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const contracts = useContracts();
  const payments = usePayments();
  const ipc = useIPCHistory(36);
  const icl = useICLHistory();
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

    const toSync: {
      contract: (typeof contracts.data)[number];
      from: string;
      restoredRent: number | null;
    }[] = [];

    for (const c of contracts.data) {
      if (c.status !== "active" || c.archived_at) continue;
      if (!c.start_date || !c.end_date || !c.rent_amount) continue;
      if (attempted.current.has(`${c.id}:${monthKey}`)) continue;

      const rows = payments.data.filter((p) => p.contract_id === c.id);
      const paidBeforeLast = rows
        .filter(
          (p) =>
            p.status === "paid" &&
            c.last_adjustment_date &&
            p.period.slice(0, 7) < c.last_adjustment_date.slice(0, 7),
        )
        .sort((a, b) => b.period.localeCompare(a.period))[0];
      const needsRestore = shouldRestoreIndexRent({
        contractRent: c.rent_amount,
        lastAdjustmentDate: c.last_adjustment_date,
        nextAdjustmentDate: c.next_adjustment_date,
        todayMonth: monthKey,
        paidBeforeLast: paidBeforeLast ? cuotaAmount(paidBeforeLast) : null,
      });
      if (needsRestore) {
        if (c.adjustment_index === "ICL" && (icl.isLoading || !(icl.data && icl.data.length))) continue;
        if (c.adjustment_index !== "ICL" && (ipc.isLoading || !(ipc.data && ipc.data.length))) continue;
      }

      const pastAmounts = rows
        .filter((p) => p.status === "paid" || p.period.slice(0, 7) < monthKey)
        .map(cuotaAmount);
      let restored = stickyPactadoRent(c.rent_amount, pastAmounts).pactado;
      if (needsRestore) {
        const base = paidBeforeLast ? cuotaAmount(paidBeforeLast) : c.rent_amount;
        const periodMonths = c.adjustment_period_months ?? 12;
        const due = c.last_adjustment_date!;
        const adj =
          c.adjustment_index === "ICL"
            ? computeAccumulatedIclAdjustment(icl.data ?? [], base, due, periodMonths)
            : computeAccumulatedIpcAdjustment(ipc.data ?? [], base, due, periodMonths);
        if (adj.available && adj.newRentAmount != null) {
          restored = Math.max(restored, Math.round(adj.newRentAmount));
        }
      }

      const latest = latestPeriod.get(c.id);
      const from = latest ? nextMonthStart(latest) : fallbackFrom;
      toSync.push({
        contract: c,
        from,
        restoredRent: restored > Math.round(c.rent_amount) ? restored : null,
      });
    }
    if (toSync.length === 0) return;

    for (const { contract } of toSync) attempted.current.add(`${contract.id}:${monthKey}`);

    void Promise.allSettled(
      toSync.map(async ({ contract: c, from, restoredRent }) => {
        if (restoredRent != null) {
          const { error } = await supabase
            .schema("nodo_inmo")
            .from("contracts")
            .update({ rent_amount: restoredRent })
            .eq("id", c.id);
          if (error) throw error;
        }
        await syncContractInstallments(
          orgId,
          {
            ...c,
            rent_amount: restoredRent ?? c.rent_amount,
          },
          c.charge_concepts.map((cc) => ({ id: cc.id, default_amount: cc.default_amount })),
          from,
        );
      }),
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CONTRACTS_QUERY_KEY });
    });
  }, [
    orgId,
    contracts.data,
    payments.data,
    queryClient,
    ipc.data,
    ipc.isLoading,
    icl.data,
    icl.isLoading,
  ]);
}
