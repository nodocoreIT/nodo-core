import { describe, it, expect } from "vitest";
import {
  adjustmentWindow,
  computeAccumulatedIclAdjustment,
  computeAccumulatedIpcAdjustment,
} from "./accumulated-adjustment";
import type { ICLHistoryEntry } from "../hooks/use-icl-history";
import type { IPCHistoryEntry } from "../hooks/use-ipc-history";

const ipc: IPCHistoryEntry[] = [
  { period: "2026-05-01", value: 2.1 },
  { period: "2026-06-01", value: 1.9 },
  { period: "2026-07-01", value: 2.1 },
  { period: "2026-08-01", value: 1.7 },
];

describe("adjustmentWindow", () => {
  it("covers the period months ending the month before the due month", () => {
    expect(adjustmentWindow("2026-09-01", 4)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
  });

  it("crosses year boundaries", () => {
    expect(adjustmentWindow("2027-02-01", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("computeAccumulatedIpcAdjustment", () => {
  it("compounds every month of the window", () => {
    const out = computeAccumulatedIpcAdjustment(ipc, 1100000, "2026-09-01", 4);
    const ratio = 1.021 * 1.019 * 1.021 * 1.017;
    expect(out.available).toBe(true);
    expect(out.percentage).toBe(Math.round((ratio - 1) * 10000) / 100);
    expect(out.newRentAmount).toBe(Math.round(1100000 * ratio * 100) / 100);
  });

  it("is unavailable and names the month whose IPC isn't published yet", () => {
    const out = computeAccumulatedIpcAdjustment(ipc, 1100000, "2026-10-01", 4);
    expect(out.available).toBe(false);
    expect(out.missingMonth).toBe("2026-09");
    expect(out.newRentAmount).toBeNull();
  });
});

describe("computeAccumulatedIclAdjustment", () => {
  const icl: ICLHistoryEntry[] = [
    { period: "2026-04-30", value: 100 },
    { period: "2026-08-29", value: 110 },
    { period: "2026-08-31", value: 112 },
  ];

  it("uses the last level of the final month over the last level before the window", () => {
    const out = computeAccumulatedIclAdjustment(icl, 1000, "2026-09-01", 4);
    expect(out.available).toBe(true);
    expect(out.percentage).toBe(12);
    expect(out.newRentAmount).toBe(1120);
  });

  it("is unavailable when the final month has no published level", () => {
    const out = computeAccumulatedIclAdjustment(icl, 1000, "2026-10-01", 4);
    expect(out.available).toBe(false);
    expect(out.missingMonth).toBe("2026-09");
  });
});
