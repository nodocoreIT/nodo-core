import { describe, it, expect, vi, beforeEach } from "vitest";

const getAuthorizedPaymentMock = vi.fn();
const getPreapprovalMock = vi.fn();
vi.mock("../mp-client", () => ({
  getAuthorizedPayment: (...args: unknown[]) => getAuthorizedPaymentMock(...args),
  getPreapproval: (...args: unknown[]) => getPreapprovalMock(...args),
}));

interface TableResult {
  data: unknown;
  error: { message: string } | null;
}

function makeBuilder(result: TableResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: TableResult) => unknown) => resolve(result);
  return builder;
}

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

function stubTables(tables: Record<string, TableResult[]>) {
  const callCounts: Record<string, number> = {};
  fromMock.mockImplementation((table: string) => {
    const results = tables[table] ?? [];
    const i = callCounts[table] ?? 0;
    callCounts[table] = i + 1;
    const result = results[i] ?? results[results.length - 1] ?? { data: null, error: null };
    return makeBuilder(result);
  });
}

/** The last builder issued for `table` — the one the final operation (insert/update) in a chain landed on. */
function lastBuilderFor(table: string) {
  const matches = fromMock.mock.calls
    .map((call, i) => (call[0] === table ? fromMock.mock.results[i]?.value : undefined))
    .filter((v) => v !== undefined);
  return matches[matches.length - 1];
}

const NO_ROW = { data: null, error: null };

beforeEach(() => {
  vi.resetModules();
  fromMock.mockReset();
  getAuthorizedPaymentMock.mockReset();
  getPreapprovalMock.mockReset();
  process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
});

describe("processSubscriptionAuthorizedPayment", () => {
  it("skips without touching the DB when the MP token is not configured", async () => {
    delete process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN;
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    const result = await processSubscriptionAuthorizedPayment("invoice-1");

    expect(result).toEqual({ ok: false, skipped: "missing_token" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("skips when the invoice has no preapproval_id", async () => {
    getAuthorizedPaymentMock.mockResolvedValue({ id: "invoice-1" });
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    const result = await processSubscriptionAuthorizedPayment("invoice-1");

    expect(result).toEqual({ ok: true, skipped: "no_preapproval_id" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("skips when no subscription matches the preapproval_id", async () => {
    getAuthorizedPaymentMock.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-preapproval-x",
    });
    stubTables({ client_unit_subscriptions: [NO_ROW] });
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    const result = await processSubscriptionAuthorizedPayment("invoice-1");

    expect(result).toEqual({ ok: true, skipped: "subscription_not_matched" });
  });

  it("on approved: records the payment and resets the cycle from the payment date, not the original anniversary", async () => {
    getAuthorizedPaymentMock.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-preapproval-x",
      transaction_amount: 4990,
      debit_date: "2026-11-20T10:00:00.000Z",
      payment: { id: "mp-payment-1", status: "approved" },
    });
    stubTables({
      client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }],
      subscription_payments: [NO_ROW, NO_ROW],
    });
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    const result = await processSubscriptionAuthorizedPayment("invoice-1");

    expect(result).toEqual({ ok: true, subscriptionId: "sub-1" });

    const paymentsBuilder = lastBuilderFor("subscription_payments");
    expect(paymentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: "sub-1",
        cycle_key: "2026-11",
        mp_payment_id: "mp-payment-1",
        amount: 4990,
        status: "approved",
      }),
    );

    const subBuilder = lastBuilderFor("client_unit_subscriptions");
    expect(subBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        cycle_started_at: "2026-11-20T10:00:00.000Z",
        next_due_at: "2026-12-20T10:00:00.000Z",
      }),
    );
  });

  it("on a non-approved payment: records the attempt but never touches the subscription's cycle/status", async () => {
    getAuthorizedPaymentMock.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-preapproval-x",
      transaction_amount: 4990,
      debit_date: "2026-11-20T10:00:00.000Z",
      payment: { id: "mp-payment-1", status: "rejected" },
    });
    stubTables({
      client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }],
      subscription_payments: [NO_ROW],
    });
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    const result = await processSubscriptionAuthorizedPayment("invoice-1");

    expect(result).toEqual({
      ok: true,
      subscriptionId: "sub-1",
      skipped: "payment_status:rejected",
    });

    const subBuilder = lastBuilderFor("client_unit_subscriptions");
    expect(subBuilder.update).not.toHaveBeenCalled();
  });

  it("is idempotent on webhook redelivery — does not insert a second row for the same mp_payment_id", async () => {
    getAuthorizedPaymentMock.mockResolvedValue({
      id: "invoice-1",
      preapproval_id: "mp-preapproval-x",
      transaction_amount: 4990,
      debit_date: "2026-11-20T10:00:00.000Z",
      payment: { id: "mp-payment-1", status: "approved" },
    });
    stubTables({
      client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }],
      subscription_payments: [{ data: { id: "existing-row" }, error: null }],
    });
    const { processSubscriptionAuthorizedPayment } = await import("../mp-webhook-handler");

    await processSubscriptionAuthorizedPayment("invoice-1");

    const paymentsBuilder = lastBuilderFor("subscription_payments");
    expect(paymentsBuilder.insert).not.toHaveBeenCalled();
  });
});

describe("processSubscriptionPreapprovalUpdate", () => {
  it("skips when no subscription matches the preapproval_id", async () => {
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: "authorized" });
    stubTables({ client_unit_subscriptions: [NO_ROW] });
    const { processSubscriptionPreapprovalUpdate } = await import("../mp-webhook-handler");

    const result = await processSubscriptionPreapprovalUpdate("mp-preapproval-x");

    expect(result).toEqual({ ok: true, skipped: "subscription_not_matched" });
  });

  it.each([
    ["authorized", "active"],
    ["cancelled", "paused"],
    ["paused", "past_due"],
  ])("maps MP preapproval status '%s' to client_unit_subscriptions status '%s'", async (mpStatus, expected) => {
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: mpStatus });
    stubTables({ client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }] });
    const { processSubscriptionPreapprovalUpdate } = await import("../mp-webhook-handler");

    await processSubscriptionPreapprovalUpdate("mp-preapproval-x");

    const subBuilder = lastBuilderFor("client_unit_subscriptions");
    expect(subBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: expected }),
    );
  });

  it("never touches client_units.status directly", async () => {
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: "cancelled" });
    stubTables({ client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }] });
    const { processSubscriptionPreapprovalUpdate } = await import("../mp-webhook-handler");

    await processSubscriptionPreapprovalUpdate("mp-preapproval-x");

    expect(fromMock).not.toHaveBeenCalledWith("client_units");
  });
});
