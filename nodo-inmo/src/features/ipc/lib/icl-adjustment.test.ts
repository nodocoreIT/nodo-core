import { describe, it, expect } from "vitest";
import { computeIclAdjustment } from "./icl-adjustment";
import type { ICLHistoryEntry } from "../hooks/use-icl-history";

const history: ICLHistoryEntry[] = [
  { period: "2026-06-01", value: 30 },
  { period: "2026-07-15", value: 31.5 },
  { period: "2026-08-30", value: 33 },
];

describe("computeIclAdjustment", () => {
  it("uses only the single-step variation vs. the previous month — not interannual", () => {
    const out = computeIclAdjustment(history, 100000, new Date("2026-08-31"));
    // Aug level (33) vs Jul level (31.5), not vs a level from a year ago
    const ratio = 33 / 31.5;
    expect(out.available).toBe(true);
    expect(out.percentage).toBeCloseTo((ratio - 1) * 100, 2);
    expect(out.newRentAmount).toBeCloseTo(100000 * ratio, 1);
  });

  it("picks the latest published level within a month when several exist", () => {
    const multi: ICLHistoryEntry[] = [
      { period: "2026-07-01", value: 31 },
      { period: "2026-07-15", value: 31.5 },
      { period: "2026-08-05", value: 33 },
    ];
    const out = computeIclAdjustment(multi, 100000, new Date("2026-08-10"));
    expect(out.percentage).toBeCloseTo((33 / 31.5 - 1) * 100, 2);
  });

  it("is unavailable when the current month's level hasn't been published yet", () => {
    const out = computeIclAdjustment(history, 100000, new Date("2026-09-11"));
    expect(out.available).toBe(false);
    expect(out.percentage).toBeNull();
    expect(out.newRentAmount).toBeNull();
  });

  it("is unavailable when the previous month's level is missing", () => {
    const gappy: ICLHistoryEntry[] = [{ period: "2026-08-30", value: 33 }];
    const out = computeIclAdjustment(gappy, 100000, new Date("2026-08-31"));
    expect(out.available).toBe(false);
  });
});
