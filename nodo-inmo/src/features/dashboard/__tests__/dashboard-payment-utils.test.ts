import { describe, it, expect } from "vitest";
import {
  isOperationalPayment,
  isUnpaidPayment,
} from "../lib/dashboard-payment-utils";
import type { PaymentWithRelations } from "@/features/payments/hooks/use-payments";

function payment(
  overrides: Partial<PaymentWithRelations> & {
    contract?: PaymentWithRelations["contract"];
  } = {},
): PaymentWithRelations {
  return {
    id: "p1",
    org_id: "org",
    contract_id: "c1",
    period: "2026-01-01",
    due_date: "2026-01-10",
    amount: 1000,
    currency: "ARS",
    status: "pending",
    paid_date: null,
    paid_amount: null,
    payment_method: null,
    notes: null,
    created_at: "",
    updated_at: "",
    contract: {
      rent_amount: 1000,
      commission_amount: null,
      archived_at: null,
      property: null,
      tenant: null,
    },
    ...overrides,
  };
}

describe("isOperationalPayment", () => {
  it("includes payments from active contracts", () => {
    expect(isOperationalPayment(payment())).toBe(true);
  });

  it("excludes payments from archived contracts", () => {
    expect(
      isOperationalPayment(
        payment({
          contract: {
            rent_amount: 1000,
            commission_amount: null,
            archived_at: "2026-06-18",
            property: null,
            tenant: null,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("isUnpaidPayment", () => {
  it("treats cancelled as paid for dashboard debt purposes", () => {
    expect(isUnpaidPayment({ status: "cancelled" })).toBe(false);
  });
});
