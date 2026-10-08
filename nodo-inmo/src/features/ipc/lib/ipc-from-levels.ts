import type { IPCHistoryEntry } from "../hooks/use-ipc-history";
import { shiftMonth } from "./accumulated-adjustment";
import { keepClosedMonths, monthKey, previousMonthPeriod } from "./merge-index-history";

export type IpcLevelRow = { period: string; level: number };

export function monthlyPercent(prevLevel: number, nextLevel: number): number {
  return parseFloat(((nextLevel / prevLevel - 1) * 100).toFixed(2));
}

/**
 * Build monthly IPC history from INDEC index levels, then extend unpublished
 * closed months with the manual rate (provisional until the official level exists).
 */
export function buildIpcHistoryFromLevels(
  levels: IpcLevelRow[],
  manuals: Array<{ period: string; value: number }>,
  from = new Date(),
): IPCHistoryEntry[] {
  const official = [...levels]
    .filter((row) => Number.isFinite(row.level) && row.level > 0)
    .sort((a, b) => a.period.localeCompare(b.period));

  const byKey = new Map<string, IPCHistoryEntry>();
  for (let i = 0; i < official.length; i++) {
    const curr = official[i];
    const prev = official[i - 1];
    const period = `${monthKey(curr.period)}-01`;
    byKey.set(monthKey(curr.period), {
      period,
      value: prev ? monthlyPercent(prev.level, curr.level) : 0,
      level: curr.level,
    });
  }

  const lastOfficial = official[official.length - 1];
  if (lastOfficial) {
    const rateByMonth = new Map(
      manuals.map((m) => [monthKey(m.period), m.value] as const),
    );
    let cursorKey = monthKey(lastOfficial.period);
    let cursorLevel = lastOfficial.level;
    const lastClosed = monthKey(previousMonthPeriod(from));
    while (cursorKey < lastClosed) {
      const next = shiftMonth(cursorKey, 1);
      const rate = rateByMonth.get(next);
      if (rate == null) break;
      cursorLevel *= 1 + rate / 100;
      byKey.set(next, {
        period: `${next}-01`,
        value: rate,
        level: cursorLevel,
      });
      cursorKey = next;
    }
  }

  return keepClosedMonths([...byKey.values()], from).sort((a, b) =>
    b.period.localeCompare(a.period),
  );
}
