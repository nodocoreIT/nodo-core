import { describe, it, expect } from "vitest";
import { computeIpcAdjustment } from "./ipc-adjustment";
import type { IPCHistoryEntry } from "../hooks/use-ipc-history";

const history: IPCHistoryEntry[] = [
  { period: "2026-07-01", value: 2 },
  { period: "2026-08-01", value: 1.7 },
];

describe("computeIpcAdjustment", () => {
  it("applies only the current month's published IPC rate — never compounded", () => {
    const out = computeIpcAdjustment(history, 100000, new Date("2026-08-15"));
    expect(out.available).toBe(true);
    expect(out.percentage).toBe(1.7);
    expect(out.newRentAmount).toBe(Math.round(100000 * 1.017 * 100) / 100);
  });

  it("is unavailable when the current month's IPC hasn't been published yet", () => {
    const out = computeIpcAdjustment(history, 100000, new Date("2026-09-11"));
    expect(out.available).toBe(false);
    expect(out.percentage).toBeNull();
    expect(out.newRentAmount).toBeNull();
  });

  it("ignores older months even when several were skipped — no accumulation", () => {
    const longHistory: IPCHistoryEntry[] = [
      { period: "2026-05-01", value: 3 },
      { period: "2026-06-01", value: 2.5 },
      { period: "2026-07-01", value: 2 },
      { period: "2026-08-01", value: 1.7 },
    ];
    const out = computeIpcAdjustment(longHistory, 100000, new Date("2026-08-20"));
    expect(out.percentage).toBe(1.7); // not 3+2.5+2+1.7 compounded
  });
});
