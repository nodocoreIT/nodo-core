import { useMemo } from "react";
import { usePayments } from "@/features/payments/hooks/use-payments";
import type { PaymentWithRelations } from "@/features/payments/hooks/use-payments";
import { useOwnerSettlements } from "@/features/caja/hooks/use-owner-settlements";
import { useContracts } from "@/features/contracts/hooks/use-contracts";
import { effectiveStatus } from "@/features/payments/lib/payment-labels";
import { groupPendingByOwner } from "@/features/caja/lib/caja-math";
import { useAlertSettings, type AlertSettings } from "@/shared/hooks/use-alert-settings";
import { isOverdue } from "@/features/payments/lib/generate-installments";
import {
  collectionStatusForPayments,
  formatMonthSlash,
  isCurrentMonthPayment,
  isPastMonthPayment,
  monthKey,
  remainingAmount,
  type CollectionStatus,
  isOperationalPayment,
} from "../lib/dashboard-payment-utils";

// ── Public types ──────────────────────────────────────────────────────────────

/** Per-currency monetary totals keyed by currency code (e.g. "ARS", "USD").
 *  NEVER collapse different currencies into a single scalar. */
export type CurrencyTotals = Record<string, number>;

export interface MetricGroup {
  count: number;
  totalByCurrency: CurrencyTotals;
}

export interface OverdueItem {
  id: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface PendingOwnerItem {
  ownerId: string;
  ownerName: string;
  total: number;
  currency: string;
}

export interface PastDebtItem {
  id: string;
  tenantName: string;
  monthLabel: string;
  amount: number;
  currency: string;
}

export interface MonthCollectionPayment {
  id: string;
  remaining: number;
}

export interface MonthCollectionItem {
  key: string;
  tenantName: string;
  propertyAddress: string;
  status: CollectionStatus;
  balance: number;
  currency: string;
  payments: MonthCollectionPayment[];
  alerts: { type: "expiration" | "adjustment"; text: string }[];
}

export interface RecentReceiptItem {
  id: string;
  tenantName: string;
  amount: number;
  currency: string;
  paidDate: string;
}

export interface DashboardMetrics {
  overduePayments: MetricGroup & { items: OverdueItem[] };
  pendingSettlements: MetricGroup & { items: PendingOwnerItem[] };
  recentSealed: MetricGroup;
  activeContracts: number;
  pastMonthDebts: PastDebtItem[];
  currentMonthCollections: MonthCollectionItem[];
  recentReceipts: RecentReceiptItem[];
  loading: boolean;
  error: unknown;
}

// ── Private constants + helpers ───────────────────────────────────────────────

export const RECENT_SEALED_WINDOW_DAYS = 30;

function sumByCurrency<T>(
  rows: T[],
  pick: (row: T) => { amount: number; currency: string },
): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const row of rows) {
    const { amount, currency } = pick(row);
    out[currency] = (out[currency] ?? 0) + amount;
  }
  return out;
}

function startOfDayMinusDays(today: Date, days: number): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}


function buildPastMonthDebts(
  paymentRows: PaymentWithRelations[],
  today: Date,
): PastDebtItem[] {
  return paymentRows
    .filter((p) => isPastMonthPayment(p, today))
    .map((p) => ({
      id: p.id,
      tenantName: p.contract?.tenant?.name ?? "—",
      monthLabel: formatMonthSlash(monthKey(p.due_date)),
      amount: remainingAmount(p),
      currency: p.currency,
    }))
    .sort((a, b) => b.monthLabel.localeCompare(a.monthLabel));
}

function buildCurrentMonthCollections(
  paymentRows: PaymentWithRelations[],
  today: Date,
  alertSettings: AlertSettings
): MonthCollectionItem[] {
  const current = paymentRows.filter((p) => isCurrentMonthPayment(p, today));
  const groups = new Map<string, PaymentWithRelations[]>();

  for (const payment of current) {
    const tenantName = payment.contract?.tenant?.name ?? "—";
    const propertyAddress = payment.contract?.property?.address ?? "—";
    const groupKey = `${tenantName}::${propertyAddress}::${payment.currency}`;
    const bucket = groups.get(groupKey) ?? [];
    bucket.push(payment);
    groups.set(groupKey, bucket);
  }

  return Array.from(groups.entries())
    .map(([key, payments]) => {
      const first = payments[0];
      const tenantName = first.contract?.tenant?.name ?? "—";
      const propertyAddress = first.contract?.property?.address ?? "—";
      const balance = payments.reduce((sum, p) => sum + remainingAmount(p), 0);
      const contract = first.contract;

      const alerts: { type: "expiration" | "adjustment"; text: string }[] = [];
      if (contract) {
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (contract.end_date) {
          const [endYear, endMonth, endDay] = contract.end_date.split("-").map(Number);
          const startOfEndDate = new Date(endYear, endMonth - 1, endDay);
          const diffTime = startOfEndDate.getTime() - startOfToday.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const limitDays = alertSettings.contractExpirationMonths * 30;

          if (diffDays >= 0 && diffDays <= limitDays) {
            const text = diffDays === 0
              ? "Vence hoy"
              : diffDays === 1
              ? "Vence en 1 día"
              : `Vence en ${diffDays} días`;
            alerts.push({ type: "expiration", text });
          }
        }

        if (contract.next_adjustment_date) {
          const [adjYear, adjMonth, adjDay] = contract.next_adjustment_date.split("-").map(Number);
          const startOfAdjDate = new Date(adjYear, adjMonth - 1, adjDay);
          const diffTime = startOfAdjDate.getTime() - startOfToday.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const limitDays = alertSettings.rentAdjustmentMonths * 30;

          if (diffDays >= 0 && diffDays <= limitDays) {
            const text = diffDays === 0
              ? "Ajuste hoy"
              : diffDays === 1
              ? "Ajuste en 1 día"
              : `Ajuste en ${diffDays} días`;
            alerts.push({ type: "adjustment", text });
          }
        }
      }

      return {
        key,
        tenantName,
        propertyAddress,
        status: collectionStatusForPayments(payments),
        balance,
        currency: first.currency,
        payments: payments.map((p) => ({
          id: p.id,
          remaining: remainingAmount(p),
        })),
        alerts,
      };
    })
    .filter((item) => item.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

function buildRecentReceipts(
  paymentRows: PaymentWithRelations[],
): RecentReceiptItem[] {
  return paymentRows
    .filter((p) => p.status === "paid" && p.paid_date)
    .sort((a, b) => (b.paid_date ?? "").localeCompare(a.paid_date ?? ""))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      tenantName: p.contract?.tenant?.name ?? "—",
      amount: p.paid_amount ?? p.amount,
      currency: p.currency,
      paidDate: p.paid_date!,
    }));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardMetrics(today: Date = new Date()): DashboardMetrics {
  const payments = usePayments();
  const settlements = useOwnerSettlements();
  const contracts = useContracts();
  const { settings: alertSettings } = useAlertSettings();

  const loading =
    payments.isLoading || settlements.isLoading || contracts.isLoading;
  const error = payments.error ?? settlements.error ?? contracts.error ?? null;

  return useMemo<DashboardMetrics>(() => {
    const paymentRows = (payments.data ?? []).filter(isOperationalPayment);
    const settlementRows = settlements.data ?? [];
    const contractRows = (contracts.data ?? []).filter((c) => !c.archived_at);

    // Active contracts
    const activeContracts = contractRows.filter(
      (c) => c.status === "active",
    ).length;

    // Overdue payments
    const overdue = paymentRows.filter((p) => {
      const eff = effectiveStatus(p, today);
      return eff === "overdue" || (eff === "partial" && isOverdue(p, today));
    });
    const overduePayments = {
      count: overdue.length,
      totalByCurrency: sumByCurrency(overdue, (p) => ({
        amount: remainingAmount(p),
        currency: p.currency,
      })),
      items: overdue.map((p) => ({
        id: p.id,
        tenantName: p.contract?.tenant?.name ?? "—",
        propertyAddress: p.contract?.property?.address ?? "—",
        amount: remainingAmount(p),
        currency: p.currency,
        dueDate: p.due_date,
      })),
    };

    // Pending settlements — reuse groupPendingByOwner (currency-safe)
    const groups = groupPendingByOwner(settlementRows);
    const pendingSettlements = {
      count: groups.length,
      totalByCurrency: sumByCurrency(groups, (g) => ({
        amount: g.total,
        currency: g.currency,
      })),
      items: groups.map((g) => ({
        ownerId: g.owner_id,
        ownerName: g.owner_name,
        total: g.total,
        currency: g.currency,
      })),
    };

    // Recently sealed (last 30 days)
    const cutoff = startOfDayMinusDays(today, RECENT_SEALED_WINDOW_DAYS);
    const sealed = settlementRows.filter(
      (s) =>
        s.status === "settled" &&
        s.settled_date != null &&
        new Date(s.settled_date) >= cutoff,
    );
    const recentSealed = {
      count: sealed.length,
      totalByCurrency: sumByCurrency(sealed, (s) => ({
        amount: s.amount,
        currency: s.currency,
      })),
    };

    const pastMonthDebts = buildPastMonthDebts(paymentRows, today);
    const currentMonthCollections = buildCurrentMonthCollections(
      paymentRows,
      today,
      alertSettings
    );
    const recentReceipts = buildRecentReceipts(paymentRows);

    return {
      overduePayments,
      pendingSettlements,
      recentSealed,
      activeContracts,
      pastMonthDebts,
      currentMonthCollections,
      recentReceipts,
      loading,
      error,
    };
  }, [payments.data, settlements.data, contracts.data, today, loading, error, alertSettings]);
}
