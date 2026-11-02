import { advanceAdjustmentDate } from "@/features/contracts/lib/advance-adjustment-date";

/**
 * Alquiler that must hold until the next IPC/ICL.
 * Auto-generated months must never step backwards vs a cuota already issued
 * in this adjustment window (e.g. cobrado at $1.188.448, next month $1.100.000).
 */
export function stickyPactadoRent(
  contractRent: number,
  windowAmounts: number[],
): { pactado: number; sourceAmount: number | null } {
  const rent = Math.round(contractRent);
  let maxWindow: number | null = null;
  for (const amount of windowAmounts) {
    const rounded = Math.round(amount);
    if (maxWindow == null || rounded > maxWindow) maxWindow = rounded;
  }
  if (maxWindow == null) return { pactado: rent, sourceAmount: null };
  return { pactado: Math.max(rent, maxWindow), sourceAmount: maxWindow };
}

export function adjustmentWindowSize(periodMonths: number | null | undefined): number {
  return Math.max(1, periodMonths ?? 12);
}

/** Look back a year of cuotas so a 4-month IPC is still visible in November. */
export const PACTADO_LOOKBACK_MONTHS = 12;

/**
 * Aplicar aumento already rolled last/next dates, but rent_amount was later
 * overwritten back to the pre-IPC value. Don't wait for the next due date.
 */
export function shouldRestoreIndexRent(input: {
  contractRent: number;
  lastAdjustmentDate: string | null | undefined;
  nextAdjustmentDate: string | null | undefined;
  todayMonth: string;
  paidBeforeLast: number | null;
}): boolean {
  if (!input.lastAdjustmentDate || !input.nextAdjustmentDate) return false;
  if (input.nextAdjustmentDate.slice(0, 7) <= input.todayMonth) return false;
  if (input.paidBeforeLast == null) return false;
  return Math.round(input.contractRent) <= Math.round(input.paidBeforeLast) + 1;
}

/** If próximo aumento is still in the past after an IPC already cobrado, roll the window forward. */
export function rollAdjustmentDatesIfStale(input: {
  lastAdjustmentDate: string | null | undefined;
  nextAdjustmentDate: string | null | undefined;
  periodMonths: number;
  increasedPeriod: string;
  todayMonth: string;
}): { last_adjustment_date: string; next_adjustment_date: string } | null {
  const period = adjustmentWindowSize(input.periodMonths);
  const nextKey = input.nextAdjustmentDate?.slice(0, 7);
  if (nextKey && nextKey > input.todayMonth) return null;

  const last = input.lastAdjustmentDate ?? input.increasedPeriod;
  let next = advanceAdjustmentDate(last, period);
  if (next.slice(0, 7) > input.todayMonth) {
    return { last_adjustment_date: last, next_adjustment_date: next };
  }
  return {
    last_adjustment_date: input.increasedPeriod,
    next_adjustment_date: advanceAdjustmentDate(input.increasedPeriod, period),
  };
}
