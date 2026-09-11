import { describe, it, expect } from "vitest";
import { buildIclMonthlyHistory } from "./icl-monthly-history";
import type { ICLHistoryEntry } from "../hooks/use-icl-history";

function daily(period: string, value: number): ICLHistoryEntry {
  return { period, value };
}

describe("buildIclMonthlyHistory", () => {
  it("collapses daily entries into one row per month, most recent first", () => {
    const history: ICLHistoryEntry[] = [
      daily("2026-07-01", 34.24),
      daily("2026-07-15", 34.72), // should be ignored — only day 1 matters
      daily("2026-08-01", 35.01),
      daily("2026-08-15", 35.23),
      daily("2026-09-01", 35.74),
    ];

    const rows = buildIclMonthlyHistory(history, new Date("2026-09-11"), 3);

    expect(rows.map((r) => r.period)).toEqual(["2026-09-01", "2026-08-01", "2026-07-01"]);
  });

  it("computes month-over-month % from first-of-month levels only", () => {
    const history: ICLHistoryEntry[] = [
      daily("2026-08-01", 35.01),
      daily("2026-09-01", 35.74),
    ];

    const rows = buildIclMonthlyHistory(history, new Date("2026-09-11"), 2);

    const sep = rows.find((r) => r.period === "2026-09-01")!;
    expect(sep.monthlyPercentage).toBeCloseTo(((35.74 / 35.01 - 1) * 100), 1);
  });

  it("computes the interannual % against the same month a year back", () => {
    const history: ICLHistoryEntry[] = [
      daily("2025-09-01", 21.9),
      daily("2026-08-01", 35.01),
      daily("2026-09-01", 35.74),
    ];

    const rows = buildIclMonthlyHistory(history, new Date("2026-09-11"), 1);

    expect(rows[0].interannualPercentage).toBeCloseTo(((35.74 / 21.9 - 1) * 100), 1);
  });

  it("falls back to the earliest day in the month when day 1 is missing", () => {
    const history: ICLHistoryEntry[] = [
      daily("2026-08-03", 35.05),
      daily("2026-08-15", 35.23),
    ];

    const rows = buildIclMonthlyHistory(history, new Date("2026-08-20"), 1);

    expect(rows[0].monthlyPercentage).toBeNull(); // no July data at all
    expect(rows[0].period).toBe("2026-08-01");
  });

  it("skips months with no data instead of returning a null-filled row", () => {
    const history: ICLHistoryEntry[] = [daily("2026-09-01", 35.74)];

    const rows = buildIclMonthlyHistory(history, new Date("2026-09-11"), 3);

    expect(rows).toHaveLength(1);
    expect(rows[0].period).toBe("2026-09-01");
  });
});
