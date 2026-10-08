import { describe, expect, it } from "vitest";
import { computeAccumulatedIpcAdjustment } from "./accumulated-adjustment";
import { buildIpcHistoryFromLevels } from "./ipc-from-levels";

const officialLevels = [
  { period: "2026-03-01", level: 11077.0608 },
  { period: "2026-04-01", level: 11363.0904 },
  { period: "2026-05-01", level: 11607.3937 },
  { period: "2026-06-01", level: 11826.4103 },
  { period: "2026-07-01", level: 12076.3937 },
  { period: "2026-08-01", level: 12276.766 },
];

describe("buildIpcHistoryFromLevels", () => {
  it("uses INDEC monthly percents with two decimals, not the 1-decimal API", () => {
    const history = buildIpcHistoryFromLevels(officialLevels, [], new Date(2026, 9, 8));
    const aug = history.find((h) => h.period.startsWith("2026-08"));
    const apr = history.find((h) => h.period.startsWith("2026-04"));
    expect(aug?.value).toBe(1.66);
    expect(apr?.value).toBe(2.58);
  });

  it("extends September with the manual rate on the August level", () => {
    const history = buildIpcHistoryFromLevels(
      officialLevels,
      [{ period: "2026-09-01", value: 1.66 }],
      new Date(2026, 9, 8),
    );
    const sep = history.find((h) => h.period.startsWith("2026-09"));
    expect(sep?.value).toBe(1.66);
    expect(sep?.level).toBeCloseTo(12276.766 * 1.0166, 4);
  });
});

describe("computeAccumulatedIpcAdjustment with levels", () => {
  it("matches the official calculator for a 6-month October adjustment", () => {
    const history = buildIpcHistoryFromLevels(
      officialLevels,
      [{ period: "2026-09-01", value: 1.66 }],
      new Date(2026, 9, 8),
    );
    const out = computeAccumulatedIpcAdjustment(history, 443200, "2026-10-01", 6);
    expect(out.available).toBe(true);
    expect(out.percentage).toBe(12.67);
    expect(out.newRentAmount).toBeCloseTo(499355, 0);
  });
});
