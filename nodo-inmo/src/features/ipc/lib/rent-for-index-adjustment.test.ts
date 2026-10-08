import { describe, expect, it } from "vitest";
import { rentForIndexAdjustment } from "./rent-for-index-adjustment";

describe("rentForIndexAdjustment", () => {
  it("uses contract rent when it is alquiler only", () => {
    expect(rentForIndexAdjustment(468000, 468000, 50000)).toBe(468000);
  });

  it("strips expensas if contract rent was saved as alquiler + expensas", () => {
    expect(rentForIndexAdjustment(577400, 527400, 50000)).toBe(527400);
  });

  it("does not subtract when there are no expensas on the cuota", () => {
    expect(rentForIndexAdjustment(577400, 577400, 0)).toBe(577400);
  });
});
