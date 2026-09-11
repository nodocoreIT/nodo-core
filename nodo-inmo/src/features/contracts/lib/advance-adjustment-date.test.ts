import { describe, it, expect } from "vitest";
import { advanceAdjustmentDate } from "./advance-adjustment-date";

describe("advanceAdjustmentDate", () => {
  it("adds whole months, keeping the day-of-month", () => {
    expect(advanceAdjustmentDate("2026-06-01", 6)).toBe("2026-12-01");
    expect(advanceAdjustmentDate("2026-12-15", 3)).toBe("2027-03-15");
  });

  it("clamps the day to the target month's length", () => {
    expect(advanceAdjustmentDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(advanceAdjustmentDate("2024-01-31", 1)).toBe("2024-02-29"); // leap year
  });

  it("rolls over the year when months push past December", () => {
    expect(advanceAdjustmentDate("2026-11-01", 12)).toBe("2027-11-01");
  });
});
