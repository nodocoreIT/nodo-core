import { describe, expect, it } from "vitest";
import {
  buildRentIncreaseWhatsAppMessage,
  toWhatsAppPhone,
} from "./rent-increase-whatsapp";

describe("toWhatsAppPhone", () => {
  it("normalizes local Argentine mobiles to 549…", () => {
    expect(toWhatsAppPhone("2954-586125")).toBe("5492954586125");
    expect(toWhatsAppPhone("+54 9 2954 586125")).toBe("5492954586125");
  });
});

describe("buildRentIncreaseWhatsAppMessage", () => {
  it("includes agency, date, index and current rent", () => {
    const text = buildRentIncreaseWhatsAppMessage({
      tenantName: "Guillermo Zimermann",
      agencyName: "Milton López",
      propertyAddress: "Congreso 1750 Depto A",
      adjustmentIndex: "IPC",
      nextAdjustmentDate: "2026-10-01",
      rentAmount: 500000,
      currency: "ARS",
    });
    expect(text).toContain("Hola Guillermo");
    expect(text).toContain("inmobiliaria Milton López");
    expect(text).toContain("Congreso 1750 Depto A");
    expect(text).toContain("IPC");
    expect(text).toContain("octubre");
    expect(text).toContain("500.000");
  });
});
