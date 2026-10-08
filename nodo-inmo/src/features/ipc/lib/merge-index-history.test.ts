import { describe, expect, it } from "vitest";
import {
  closedMonthOrPrevious,
  formatIpcPercent,
  keepClosedMonths,
  mergeIndexHistory,
  previousMonthPeriod,
} from "./merge-index-history";

describe("mergeIndexHistory", () => {
  it("fills a missing official month with the manual value", () => {
    const official = [{ period: "2026-08-01", value: 1.7 }];
    const manual = [{ period: "2026-09-01", value: 1.6 }];
    expect(mergeIndexHistory(official, manual)).toEqual([
      { period: "2026-09-01", value: 1.6 },
      { period: "2026-08-01", value: 1.7 },
    ]);
  });

  it("lets the official value replace the provisional one for the same month", () => {
    const official = [{ period: "2026-09-01", value: 1.65 }];
    const manual = [{ period: "2026-09-01", value: 1.6 }];
    expect(mergeIndexHistory(official, manual)).toEqual([
      { period: "2026-09-01", value: 1.65 },
    ]);
  });
});

describe("previousMonthPeriod", () => {
  it("returns the first day of the previous month", () => {
    expect(previousMonthPeriod(new Date(2026, 9, 8))).toBe("2026-09-01");
  });
});

describe("keepClosedMonths", () => {
  it("drops the current calendar month", () => {
    const now = new Date(2026, 9, 8);
    expect(
      keepClosedMonths(
        [
          { period: "2026-10-01", value: 1.7 },
          { period: "2026-09-01", value: 1.6 },
          { period: "2026-08-01", value: 1.7 },
        ],
        now,
      ),
    ).toEqual([
      { period: "2026-09-01", value: 1.6 },
      { period: "2026-08-01", value: 1.7 },
    ]);
  });
});

describe("formatIpcPercent", () => {
  it("keeps two decimals instead of rounding to one", () => {
    expect(formatIpcPercent(1.66)).toBe("+1.66%");
    expect(formatIpcPercent(1.7)).toBe("+1.7%");
  });
});

describe("closedMonthOrPrevious", () => {
  it("clamps October down to September in October", () => {
    expect(closedMonthOrPrevious("2026-10-01", new Date(2026, 9, 8))).toBe("2026-09-01");
  });
});
