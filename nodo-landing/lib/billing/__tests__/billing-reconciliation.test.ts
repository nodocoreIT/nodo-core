import { describe, it, expect, vi, beforeEach } from "vitest";

const getPreapprovalMock = vi.fn();
vi.mock("../mp-client", () => ({
  getPreapproval: (...args: unknown[]) => getPreapprovalMock(...args),
}));

const sendPaymentOverdueEmailMock = vi.fn();
vi.mock("@/lib/mail", () => ({
  sendPaymentOverdueEmail: (...args: unknown[]) => sendPaymentOverdueEmailMock(...args),
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
  builder.neq = vi.fn(chain);
  builder.lte = vi.fn(chain);
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

function lastBuilderFor(table: string) {
  const matches = fromMock.mock.calls
    .map((call, i) => (call[0] === table ? fromMock.mock.results[i]?.value : undefined))
    .filter((v) => v !== undefined);
  return matches[matches.length - 1];
}

const NO_ROW = { data: null, error: null };

const CANDIDATE = {
  id: "sub-1",
  client_unit_id: "unit-1",
  mp_preapproval_id: "mp-preapproval-x",
  cycle_started_at: "2026-06-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetModules();
  fromMock.mockReset();
  getPreapprovalMock.mockReset();
  sendPaymentOverdueEmailMock.mockReset();
  process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
});

describe("runBillingReconciliation", () => {
  it("fails fast without touching the DB when the MP token is not configured", async () => {
    delete process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN;
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary.ok).toBe(false);
    expect(summary.errors[0].error).toBe("missing_token");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns an error summary when the candidates query fails", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: null, error: { message: "connection reset" } }],
    });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({
      ok: false,
      checked: 0,
      flaggedImpago: 0,
      errors: [{ subscriptionId: "*", error: "connection reset" }],
    });
  });

  it("skips a candidate that already has an approved payment for its cycle", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: [CANDIDATE], error: null }],
      subscription_payments: [{ data: { id: "payment-1" }, error: null }],
    });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({ ok: true, checked: 1, flaggedImpago: 0, errors: [] });
    expect(getPreapprovalMock).not.toHaveBeenCalled();
  });

  it("skips a candidate with no mp_preapproval_id", async () => {
    stubTables({
      client_unit_subscriptions: [
        { data: [{ ...CANDIDATE, mp_preapproval_id: null }], error: null },
      ],
      subscription_payments: [NO_ROW],
    });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary.flaggedImpago).toBe(0);
    expect(getPreapprovalMock).not.toHaveBeenCalled();
  });

  it("does not flip when MP still reports the preapproval as authorized", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: [CANDIDATE], error: null }],
      subscription_payments: [NO_ROW],
    });
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: "authorized" });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({ ok: true, checked: 1, flaggedImpago: 0, errors: [] });
    expect(fromMock).not.toHaveBeenCalledWith("client_units");
  });

  it("flips to impago, marks the subscription past_due, and sends one dunning email when MP confirms terminal state", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: [CANDIDATE], error: null }],
      subscription_payments: [NO_ROW],
      client_units: [
        {
          data: { id: "unit-1", unit_code: "Finanzas", access_user: "cliente@example.com", client_id: "client-1" },
          error: null,
        },
      ],
    });
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: "cancelled" });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({ ok: true, checked: 1, flaggedImpago: 1, errors: [] });

    const unitsBuilder = lastBuilderFor("client_units");
    expect(unitsBuilder.update).toHaveBeenCalledWith({ status: "impago" });
    expect(unitsBuilder.neq).toHaveBeenCalledWith("status", "impago");

    const subBuilder = lastBuilderFor("client_unit_subscriptions");
    expect(subBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "past_due" }),
    );

    expect(sendPaymentOverdueEmailMock).toHaveBeenCalledTimes(1);
    expect(sendPaymentOverdueEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "cliente@example.com", nodeLabel: "Finanzas" }),
    );
  });

  it("is idempotent on re-run — an already-impago unit is not flagged again and no duplicate email is sent", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: [CANDIDATE], error: null }],
      subscription_payments: [NO_ROW],
      client_units: [NO_ROW], // .neq("status", "impago") matches nothing — already impago.
    });
    getPreapprovalMock.mockResolvedValue({ id: "mp-preapproval-x", status: "cancelled" });
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({ ok: true, checked: 1, flaggedImpago: 0, errors: [] });
    expect(sendPaymentOverdueEmailMock).not.toHaveBeenCalled();
  });

  it("captures a per-candidate error without aborting the whole run", async () => {
    stubTables({
      client_unit_subscriptions: [{ data: [CANDIDATE], error: null }],
      subscription_payments: [NO_ROW],
    });
    getPreapprovalMock.mockRejectedValue(new Error("MP API timeout"));
    const { runBillingReconciliation } = await import("../billing-reconciliation");

    const summary = await runBillingReconciliation();

    expect(summary).toEqual({
      ok: true,
      checked: 1,
      flaggedImpago: 0,
      errors: [{ subscriptionId: "sub-1", error: "MP API timeout" }],
    });
  });
});
