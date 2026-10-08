import type { ICLHistoryEntry } from "../hooks/use-icl-history";
import type { IPCHistoryEntry } from "../hooks/use-ipc-history";
import { levelForMonth } from "./icl-adjustment";
import type { IndexAdjustmentResult } from "./index-adjustment-result";

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Months ("YYYY-MM") covered by an adjustment, oldest first: the
 * `periodMonths` months that end the month before the adjustment is due.
 * Indices are published a month in arrears, so an adjustment due in
 * September uses the months up to and including August.
 */
export function adjustmentWindow(nextAdjustmentDate: string, periodMonths: number): string[] {
  const dueKey = monthKey(nextAdjustmentDate);
  const length = Math.max(1, periodMonths);
  return Array.from({ length }, (_, i) => shiftMonth(dueKey, i - length));
}

const unavailable = (missingMonth: string): IndexAdjustmentResult => ({
  available: false,
  percentage: null,
  newRentAmount: null,
  missingMonth,
});

function fromRatio(ratio: number, currentRentAmount: number): IndexAdjustmentResult {
  return {
    available: true,
    percentage: Math.round((ratio - 1) * 100 * 100) / 100,
    newRentAmount: Math.round(currentRentAmount * ratio * 100) / 100,
    missingMonth: null,
  };
}

function ipcLevelForMonth(history: IPCHistoryEntry[], key: string): number | null {
  const entry = history.find((h) => monthKey(h.period) === key);
  return entry?.level != null && Number.isFinite(entry.level) ? entry.level : null;
}

/**
 * Same as the official calculator: IPC_end / IPC_start using index levels.
 * Start is the month before the window. Falls back to compounding monthly
 * rates when levels are missing. `missingMonth` is the first gap.
 */
export function computeAccumulatedIpcAdjustment(
  history: IPCHistoryEntry[],
  currentRentAmount: number,
  nextAdjustmentDate: string,
  periodMonths: number,
): IndexAdjustmentResult {
  const window = adjustmentWindow(nextAdjustmentDate, periodMonths);
  const endKey = window[window.length - 1];
  const baseKey = shiftMonth(window[0], -1);
  const endLevel = ipcLevelForMonth(history, endKey);
  const baseLevel = ipcLevelForMonth(history, baseKey);
  if (endLevel != null && baseLevel != null && baseLevel !== 0) {
    return fromRatio(endLevel / baseLevel, currentRentAmount);
  }

  let ratio = 1;
  for (const key of window) {
    const entry = history.find((h) => monthKey(h.period) === key);
    if (!entry) return unavailable(key);
    ratio *= 1 + entry.value / 100;
  }
  return fromRatio(ratio, currentRentAmount);
}

/**
 * ICL is a level, so the accumulated increase is the last level of the
 * window's final month over the last level of the month before the window.
 */
export function computeAccumulatedIclAdjustment(
  history: ICLHistoryEntry[],
  currentRentAmount: number,
  nextAdjustmentDate: string,
  periodMonths: number,
): IndexAdjustmentResult {
  const window = adjustmentWindow(nextAdjustmentDate, periodMonths);
  const endKey = window[window.length - 1];
  const baseKey = shiftMonth(window[0], -1);

  const endLevel = levelForMonth(history, endKey);
  if (endLevel === null) return unavailable(endKey);
  const baseLevel = levelForMonth(history, baseKey);
  if (baseLevel === null || baseLevel === 0) return unavailable(baseKey);

  return fromRatio(endLevel / baseLevel, currentRentAmount);
}
