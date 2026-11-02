import { describe, expect, it } from "vitest";
import {
  adjustmentWindowSize,
  rollAdjustmentDatesIfStale,
  stickyPactadoRent,
} from "./sticky-pactado-rent";

describe("stickyPactadoRent", () => {
  it("uses contract rent when there are no cuotas yet", () => {
    expect(stickyPactadoRent(1_100_000, [])).toEqual({
      pactado: 1_100_000,
      sourceAmount: null,
    });
  });

  it("keeps the increased cuota through later months even if the contract still has the old rent", () => {
    // May–Aug 1.100.000, Sep–Oct 1.188.448, Nov generated with stale contract rent.
    expect(
      stickyPactadoRent(1_100_000, [1_100_000, 1_188_448, 1_188_448]),
    ).toEqual({ pactado: 1_188_448, sourceAmount: 1_188_448 });
  });

  it("follows the contract when it already has the increased rent", () => {
    expect(stickyPactadoRent(1_188_448, [1_188_448, 1_100_000])).toEqual({
      pactado: 1_188_448,
      sourceAmount: 1_188_448,
    });
  });
});

describe("adjustmentWindowSize", () => {
  it("uses the contract period and falls back to 12", () => {
    expect(adjustmentWindowSize(4)).toBe(4);
    expect(adjustmentWindowSize(null)).toBe(12);
  });
});

describe("rollAdjustmentDatesIfStale", () => {
  it("does not touch a window that still covers later months", () => {
    expect(
      rollAdjustmentDatesIfStale({
        lastAdjustmentDate: "2026-09-01",
        nextAdjustmentDate: "2027-01-01",
        periodMonths: 4,
        increasedPeriod: "2026-09-01",
        todayMonth: "2026-11",
      }),
    ).toBeNull();
  });

  it("rolls four months from último aumento when próximo is still in the past", () => {
    expect(
      rollAdjustmentDatesIfStale({
        lastAdjustmentDate: "2026-09-01",
        nextAdjustmentDate: "2026-09-01",
        periodMonths: 4,
        increasedPeriod: "2026-09-01",
        todayMonth: "2026-11",
      }),
    ).toEqual({
      last_adjustment_date: "2026-09-01",
      next_adjustment_date: "2027-01-01",
    });
  });
});
