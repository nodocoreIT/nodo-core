import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Supabase admin client ───────────────────────────────────────────
//
// resolveFxRate() issues up to 3 sequential `.from("fx_rates")` chained
// queries (today → stale fallback → manual override). We mock each call in
// sequence with `mockReturnValueOnce` so each branch can be exercised in
// isolation, mirroring the chainable-mock pattern used in
// lib/backup/__tests__/snapshot-builder.test.ts.

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chainable(result: { data: any; error: any }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.gte = self;
  chain.lte = self;
  chain.order = self;
  chain.limit = self;
  chain.maybeSingle = () => Promise.resolve(result);
  return chain;
}

const EMPTY = { data: null, error: null };

// Import after mocks are set up.
import { resolveFxRate } from "../fx-rate";

describe("resolveFxRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("branch 1: returns today's fetched rate when present", async () => {
    mockFrom.mockReturnValueOnce(
      chainable({ data: { rate: "1234.5600", rate_date: "2026-07-27" }, error: null }),
    );

    const result = await resolveFxRate(new Date("2026-07-27T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("today");
      expect(result.rate).toBe(1234.56);
      expect(result.rateDate).toBe("2026-07-27");
    }
    // Only the first (today) query should have run.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("branch 2: falls back to most recent stored rate within N days when today is missing", async () => {
    mockFrom
      .mockReturnValueOnce(chainable(EMPTY)) // today
      .mockReturnValueOnce(
        chainable({ data: { rate: "1200.0000", rate_date: "2026-07-25" }, error: null }),
      ); // stale fallback

    const result = await resolveFxRate(new Date("2026-07-27T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("stale");
      expect(result.rate).toBe(1200);
      expect(result.rateDate).toBe("2026-07-25");
    }
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("branch 3: falls back to the admin manual override row when today and stale are both missing", async () => {
    mockFrom
      .mockReturnValueOnce(chainable(EMPTY)) // today
      .mockReturnValueOnce(chainable(EMPTY)) // stale fallback
      .mockReturnValueOnce(
        chainable({ data: { rate: "1100.0000", rate_date: "2026-07-01" }, error: null }),
      ); // manual override

    const result = await resolveFxRate(new Date("2026-07-27T12:00:00Z"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("manual");
      expect(result.rate).toBe(1100);
    }
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("branch 4: all missing → explicit failure, no charge, no crash", async () => {
    mockFrom
      .mockReturnValueOnce(chainable(EMPTY)) // today
      .mockReturnValueOnce(chainable(EMPTY)) // stale fallback
      .mockReturnValueOnce(chainable(EMPTY)); // manual override

    const result = await resolveFxRate(new Date("2026-07-27T12:00:00Z"));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("fx-unavailable");
      expect(result.detail.length).toBeGreaterThan(0);
    }
    // Explicit contract: never returns rate 0, never throws.
    expect(result).not.toHaveProperty("rate", 0);
  });

  it("does not throw when a lookup returns a Postgres error (treats it as not-found and keeps falling back)", async () => {
    mockFrom
      .mockReturnValueOnce(chainable({ data: null, error: { message: "connection reset" } }))
      .mockReturnValueOnce(chainable(EMPTY))
      .mockReturnValueOnce(chainable(EMPTY));

    await expect(resolveFxRate(new Date("2026-07-27T12:00:00Z"))).resolves.toEqual({
      ok: false,
      reason: "fx-unavailable",
      detail: expect.any(String),
    });
  });
});
