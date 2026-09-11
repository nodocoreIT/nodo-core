import type { ICLHistoryEntry } from "../hooks/use-icl-history";

export interface IclMonthlyHistoryRow {
  /** "YYYY-MM-01" — first day of the month, same convention as IPCHistoryEntry.period. */
  period: string;
  /** Month-over-month % vs. the prior month's first-of-month level. Null if either level is missing. */
  monthlyPercentage: number | null;
  /** Year-over-year % vs. the same month 12 months back. Null if that level is missing. */
  interannualPercentage: number | null;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function shiftMonthKey(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function percentChange(current: number, previous: number): number {
  return Math.round((current / previous - 1) * 1000) / 10;
}

/** The level recorded on the 1st of a given month; falls back to the earliest entry that month if day 1 is missing. */
function levelAtMonthStart(history: ICLHistoryEntry[], key: string): number | null {
  const exact = history.find((entry) => entry.period === `${key}-01`);
  if (exact) return exact.value;

  const entries = history.filter((entry) => monthKey(entry.period) === key);
  if (entries.length === 0) return null;
  return entries.reduce((earliest, entry) => (entry.period < earliest.period ? entry : earliest))
    .value;
}

/**
 * The last `count` calendar months (most recent first), each using the
 * index level as of the 1st of that month — never every daily entry, and
 * never the raw cumulative level on its own.
 */
export function buildIclMonthlyHistory(
  history: ICLHistoryEntry[],
  today: Date = new Date(),
  count = 12,
): IclMonthlyHistoryRow[] {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const rows: IclMonthlyHistoryRow[] = [];
  for (let i = 0; i < count; i++) {
    const key = shiftMonthKey(currentKey, -i);
    const level = levelAtMonthStart(history, key);
    if (level === null) continue;

    const prevLevel = levelAtMonthStart(history, shiftMonthKey(key, -1));
    const yearAgoLevel = levelAtMonthStart(history, shiftMonthKey(key, -12));

    rows.push({
      period: `${key}-01`,
      monthlyPercentage: prevLevel !== null ? percentChange(level, prevLevel) : null,
      interannualPercentage: yearAgoLevel !== null ? percentChange(level, yearAgoLevel) : null,
    });
  }
  return rows;
}
