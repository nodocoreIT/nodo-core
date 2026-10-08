import { describe, expect, it } from "vitest";
import { mergeIndexHistory, previousMonthPeriod } from "./merge-index-history";

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
