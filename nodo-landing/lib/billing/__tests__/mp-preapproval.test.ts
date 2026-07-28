import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// createPreapproval touches 3 external boundaries: the admin Supabase client
// (nodo_core tables), resolveFxRate(), and the MP REST API via global fetch.
// These tests exercise the TS orchestration logic (short-circuits, the
// FX-unavailable contract, the happy path's MP call shape) — not the live MP
// API or real Postgres, matching how the rest of this SDD change tests
// server-side logic (see node-access-reason.test.ts).

const resolveFxRateMock = vi.fn();
vi.mock("../fx-rate", () => ({
  resolveFxRate: (...args: unknown[]) => resolveFxRateMock(...args),
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
  builder.in = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.upsert = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  // Allows `await db.from(...).insert(...)` with no terminal method (fire-and-forget).
  builder.then = (resolve: (v: TableResult) => unknown) => resolve(result);
  return builder;
}

const fromMock = vi.fn();
const createAdminClientMock = vi.fn(() => ({ from: fromMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

/** Configures db.from() to return canned results per table, in call order per table. */
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

const CLIENT_UNIT_ROW = {
  data: {
    id: "unit-1",
    client_id: "client-1",
    unit_code: "Finanzas",
    plan: "unico",
    enabled_at: "2026-03-15T12:00:00.000Z",
    access_user: "cliente@example.com",
  },
  error: null,
};

const PLAN_ROW = {
  data: { id: "plan-1", price_monthly: "4.99", label: "Plan único" },
  error: null,
};

const NO_ROW = { data: null, error: null };

let originalFetch: typeof fetch;

beforeEach(() => {
  vi.resetModules();
  fromMock.mockReset();
  resolveFxRateMock.mockReset();
  process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
  originalFetch = global.fetch;
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("createPreapproval", () => {
  it("fails fast without touching the DB when the MP token is not configured", async () => {
    delete process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN;
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual({
      ok: false,
      reason: "missing_token",
      detail: expect.stringContaining("LANDING_MERCADOPAGO_ACCESS_TOKEN"),
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fails with unit_not_found when the client_unit doesn't exist", async () => {
    stubTables({ client_units: [NO_ROW] });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("missing-unit");

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "unit_not_found" }),
    );
  });

  it("fails with unit_not_enabled when enabled_at is null", async () => {
    stubTables({
      client_units: [{ data: { ...CLIENT_UNIT_ROW.data, enabled_at: null }, error: null }],
    });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "unit_not_enabled" }),
    );
  });

  it("fails with fx_unavailable and records the failed attempt when a subscription already exists", async () => {
    stubTables({
      client_units: [CLIENT_UNIT_ROW],
      planes: [PLAN_ROW],
      client_unit_subscriptions: [{ data: { id: "sub-1" }, error: null }],
    });
    resolveFxRateMock.mockResolvedValue({
      ok: false,
      reason: "fx-unavailable",
      detail: "no rate available",
    });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual({
      ok: false,
      reason: "fx_unavailable",
      detail: "no rate available",
    });
    expect(fetch).not.toHaveBeenCalled();

    const paymentsBuilder = fromMock.mock.results.find(
      (_, i) => fromMock.mock.calls[i][0] === "subscription_payments",
    )?.value;
    expect(paymentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: "sub-1",
        status: "rejected",
        failure_reason: "fx_unavailable",
      }),
    );
  });

  it("fails with fx_unavailable and records nothing when no subscription exists yet", async () => {
    stubTables({
      client_units: [CLIENT_UNIT_ROW],
      planes: [PLAN_ROW],
      client_unit_subscriptions: [NO_ROW],
    });
    resolveFxRateMock.mockResolvedValue({
      ok: false,
      reason: "fx-unavailable",
      detail: "no rate available",
    });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "fx_unavailable" }),
    );
    expect(fromMock).not.toHaveBeenCalledWith("subscription_payments");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates the Preapproval and upserts the subscription on the happy path", async () => {
    stubTables({
      client_units: [CLIENT_UNIT_ROW],
      planes: [PLAN_ROW],
      client_unit_subscriptions: [NO_ROW, { data: { id: "sub-new" }, error: null }],
    });
    resolveFxRateMock.mockResolvedValue({
      ok: true,
      rate: 1000,
      source: "today",
      rateDate: "2026-07-27",
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "mp-preapproval-1", init_point: "https://mp/init" }),
    });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual({
      ok: true,
      subscriptionId: "sub-new",
      preapprovalId: "mp-preapproval-1",
      initPoint: "https://mp/init",
      billingAmount: 4990,
      billingCurrency: "ARS",
      billingDay: expect.any(Number),
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails with mp_rejected when MP responds with an error", async () => {
    stubTables({
      client_units: [CLIENT_UNIT_ROW],
      planes: [PLAN_ROW],
      client_unit_subscriptions: [NO_ROW],
    });
    resolveFxRateMock.mockResolvedValue({
      ok: true,
      rate: 1000,
      source: "today",
      rateDate: "2026-07-27",
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "invalid payer_email" }),
    });
    const { createPreapproval } = await import("../mp-preapproval");

    const result = await createPreapproval("unit-1");

    expect(result).toEqual({
      ok: false,
      reason: "mp_rejected",
      detail: "invalid payer_email",
    });
  });
});
