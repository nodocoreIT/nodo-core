import type { ICLHistoryEntry } from "../hooks/use-icl-history";
import type { IndexAdjustmentResult } from "./index-adjustment-result";

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Latest published ICL level within a given month (ICL is published daily). */
function levelForMonth(history: ICLHistoryEntry[], key: string): number | null {
  const entries = history.filter((entry) => monthKey(entry.period) === key);
  if (entries.length === 0) return null;
  return entries.reduce((latest, entry) => (entry.period > latest.period ? entry : latest)).value;
}

/**
 * ICL is an index level, not a rate — the rent increase is the single-step
 * variation between the current month's level and the previous month's
 * level, never the interannual (year-over-year) variation.
 */
export function computeIclAdjustment(
  history: ICLHistoryEntry[],
  currentRentAmount: number,
  today: Date = new Date(),
): IndexAdjustmentResult {
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousKey = `${previous.getFullYear()}-${pad(previous.getMonth() + 1)}`;

  const currentLevel = levelForMonth(history, currentKey);
  const previousLevel = levelForMonth(history, previousKey);

  if (currentLevel === null || previousLevel === null || previousLevel === 0) {
    return { available: false, percentage: null, newRentAmount: null };
  }

  const ratio = currentLevel / previousLevel;
  const percentage = Math.round((ratio - 1) * 100 * 100) / 100;
  const newRentAmount = Math.round(currentRentAmount * ratio * 100) / 100;

  return { available: true, percentage, newRentAmount };
}
