import { describe, it, expect } from "vitest";
import { combineSealedBreakdowns } from "../lib/settlement-statement-data";
import type { SealedBreakdown } from "../lib/settlement-statement-data";

function breakdown(overrides: Partial<SealedBreakdown> = {}): SealedBreakdown {
  return {
    currency: "ARS",
    gross: 0,
    rent_gross: 0,
    expenses_gross: 0,
    commission_rate: 10,
    commission: 0,
    owner_share: 0,
    rent_net_of_commission: 0,
    charges: [],
    deductions: [],
    deduction_total: 0,
    net: 0,
    cobro_count: 0,
    ...overrides,
  };
}

describe("combineSealedBreakdowns", () => {
  it("returns the single item's breakdown as-is when given one property", () => {
    const only = breakdown({ net: 1000 });
    const result = combineSealedBreakdowns([
      { property_id: "p1", property_address: "Calle 1", breakdown: only },
    ]);
    expect(result).toBe(only);
  });

  it("sums totals and concatenates deductions across properties", () => {
    const a = breakdown({
      gross: 500000,
      rent_gross: 500000,
      commission: 50000,
      rent_net_of_commission: 450000,
      net: 438000,
      deduction_total: 12000,
      deductions: [
        { id: "e1", amount: 12000, description: "Arreglo plomería", expense_date: "2026-05-14", type: "arreglo" },
      ],
    });
    const b = breakdown({
      gross: 300000,
      rent_gross: 300000,
      commission: 30000,
      rent_net_of_commission: 270000,
      net: 270000,
      deduction_total: 0,
      deductions: [],
    });

    const result = combineSealedBreakdowns([
      { property_id: "p1", property_address: "Calle 1", breakdown: a },
      { property_id: "p2", property_address: "Calle 2", breakdown: b },
    ]);

    expect(result.gross).toBe(800000);
    expect(result.rent_gross).toBe(800000);
    expect(result.commission).toBe(80000);
    expect(result.rent_net_of_commission).toBe(720000);
    expect(result.net).toBe(708000);
    expect(result.deduction_total).toBe(12000);
    expect(result.deductions).toHaveLength(1);
    expect(result.deductions[0].description).toBe("Arreglo plomería");
  });

  it("merges non-retained charges with the same label across properties, keeps different labels separate", () => {
    const a = breakdown({ charges: [{ label: "Expensas", amount: 90000 }] });
    const b = breakdown({
      charges: [
        { label: "Expensas", amount: 40000 },
        { label: "Municipal", amount: 20000 },
      ],
    });

    const result = combineSealedBreakdowns([
      { property_id: "p1", property_address: "Calle 1", breakdown: a },
      { property_id: "p2", property_address: "Calle 2", breakdown: b },
    ]);

    expect(result.charges).toEqual([
      { label: "Expensas", amount: 130000 },
      { label: "Municipal", amount: 20000 },
    ]);
  });

  it("keeps a per-property breakdown trail in properties_detail", () => {
    const a = breakdown({ net: 100 });
    const b = breakdown({ net: 200 });

    const result = combineSealedBreakdowns([
      { property_id: "p1", property_address: "Calle 1", breakdown: a },
      { property_id: "p2", property_address: "Calle 2", breakdown: b },
    ]);

    expect(result.properties_detail).toEqual([
      { property_id: "p1", property_address: "Calle 1", breakdown: a },
      { property_id: "p2", property_address: "Calle 2", breakdown: b },
    ]);
  });
});
