import { describe, it, expect } from "vitest";
import {
  commissionRateFromProperty,
  resolveCommissionRatePercent,
} from "./resolve-commission-rate";

describe("resolveCommissionRatePercent", () => {
  it("prefers contract snapshot over property and owner rates", () => {
    expect(
      resolveCommissionRatePercent({
        contractCommissionAmount: 80000,
        contractRentAmount: 1000000,
        propertyCommissionRate: 10,
        ownerCommissionRate: 5,
      }),
    ).toBe(8);
  });

  it("falls back to property rate when contract has no commission", () => {
    expect(
      resolveCommissionRatePercent({
        propertyCommissionRate: 12,
        ownerCommissionRate: 8,
      }),
    ).toBe(12);
  });

  it("falls back to owner rate when property rate is null", () => {
    expect(
      resolveCommissionRatePercent({
        propertyCommissionRate: null,
        ownerCommissionRate: 8,
      }),
    ).toBe(8);
  });

  it("defaults to 10 when nothing is configured", () => {
    expect(resolveCommissionRatePercent({})).toBe(10);
  });
});

describe("commissionRateFromProperty", () => {
  it("reads owner commission when property has no override", () => {
    expect(
      commissionRateFromProperty({
        commission_rate: null,
        owner: { commission_rate: 8 },
      }),
    ).toBe(8);
  });
});
