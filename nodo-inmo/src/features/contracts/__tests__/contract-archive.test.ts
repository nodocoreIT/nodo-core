import { describe, it, expect } from "vitest";
import { isArchivedContract } from "@/features/contracts/lib/contract-archive";

describe("isArchivedContract", () => {
  it("returns false when archived_at is null", () => {
    expect(isArchivedContract({ archived_at: null })).toBe(false);
  });

  it("returns true when archived_at is set", () => {
    expect(isArchivedContract({ archived_at: "2026-06-18T12:00:00Z" })).toBe(true);
  });

  it("returns false for missing contract", () => {
    expect(isArchivedContract(null)).toBe(false);
  });
});
