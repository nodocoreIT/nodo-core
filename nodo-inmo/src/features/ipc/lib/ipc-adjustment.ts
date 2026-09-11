import type { IPCHistoryEntry } from "../hooks/use-ipc-history";
import type { IndexAdjustmentResult } from "./index-adjustment-result";

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * The rent increase is always the single published IPC rate for the current
 * month — never compounded across the months since the last adjustment. If
 * that month's value hasn't been published yet, the increase isn't available.
 */
export function computeIpcAdjustment(
  history: IPCHistoryEntry[],
  currentRentAmount: number,
  today: Date = new Date(),
): IndexAdjustmentResult {
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const entry = history.find((h) => monthKey(h.period) === currentMonthKey);

  if (!entry) {
    return { available: false, percentage: null, newRentAmount: null };
  }

  const newRentAmount = Math.round(currentRentAmount * (1 + entry.value / 100) * 100) / 100;
  return { available: true, percentage: entry.value, newRentAmount };
}
