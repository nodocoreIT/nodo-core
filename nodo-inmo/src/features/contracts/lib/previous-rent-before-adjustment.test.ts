import { describe, expect, it } from "vitest";
import { previousRentBeforeAdjustment } from "./previous-rent-before-adjustment";

describe("previousRentBeforeAdjustment", () => {
  it("returns the latest paid alquiler from a month before the applied increase", () => {
    const amount = previousRentBeforeAdjustment(
      [
        { contract_id: "c1", status: "paid", period: "2026-08-01", amount: 400000 },
        { contract_id: "c1", status: "paid", period: "2026-09-01", amount: 468000 },
        { contract_id: "c1", status: "pending", period: "2026-10-01", amount: 577400 },
        { contract_id: "c2", status: "paid", period: "2026-09-01", amount: 1 },
      ],
      "c1",
      "2026-10-01",
    );
    expect(amount).toBe(468000);
  });

  it("ignores a cobro in the same month as the increase", () => {
    expect(
      previousRentBeforeAdjustment(
        [{ contract_id: "c1", status: "paid", period: "2026-10-01", amount: 577400 }],
        "c1",
        "2026-10-01",
      ),
    ).toBeNull();
  });
});
