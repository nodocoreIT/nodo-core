import { describe, it, expect, vi } from "vitest";
import { getNodeAccessReason } from "@nodocore/shared-components";

// ─── Minimal Supabase client stub ─────────────────────────────────────────
//
// getNodeAccessReason only calls `.schema("public").rpc("user_node_access_reason", ...)`.
// These tests exercise the TS wrapper's contract (map RPC result -> NodeAccessReason,
// fail-open to "ok" on error) — the RPC's own SQL logic (status -> reason mapping) is
// covered by manual review + Supabase advisors against the migration itself, matching
// how the rest of this SDD change tests server-side Postgres logic.

function stubSupabase(rpcResult: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const schema = vi.fn().mockReturnValue({ rpc });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { schema, rpc } as any;
}

describe("getNodeAccessReason", () => {
  it("returns 'payment_overdue' when the RPC reports it (impago unit, access still allowed)", async () => {
    const supabase = stubSupabase({ data: "payment_overdue", error: null });
    const reason = await getNodeAccessReason(supabase, "Finanzas");
    expect(reason).toBe("payment_overdue");
    expect(supabase.schema).toHaveBeenCalledWith("public");
    expect(supabase.rpc).toHaveBeenCalledWith("user_node_access_reason", {
      p_unit_code: "Finanzas",
    });
  });

  it("returns 'banned' when the RPC reports it (auth account banned mid-session)", async () => {
    const supabase = stubSupabase({ data: "banned", error: null });
    await expect(getNodeAccessReason(supabase, "Finanzas")).resolves.toBe("banned");
  });

  it("returns 'paused' when the RPC reports it (client_unit status pausado)", async () => {
    const supabase = stubSupabase({ data: "paused", error: null });
    await expect(getNodeAccessReason(supabase, "Inmo")).resolves.toBe("paused");
  });

  it("returns 'invalid_credentials' when the RPC reports it (no matching row, or sin_acceso)", async () => {
    const supabase = stubSupabase({ data: "invalid_credentials", error: null });
    await expect(getNodeAccessReason(supabase, "Finanzas")).resolves.toBe("invalid_credentials");
  });

  it("returns 'ok' when the RPC reports it (activo and other unaffected statuses)", async () => {
    const supabase = stubSupabase({ data: "ok", error: null });
    await expect(getNodeAccessReason(supabase, "Finanzas")).resolves.toBe("ok");
  });

  it("fails open to 'ok' when the RPC returns an error — reason must never lock a user out", async () => {
    const supabase = stubSupabase({ data: null, error: { message: "connection reset" } });
    await expect(getNodeAccessReason(supabase, "Finanzas")).resolves.toBe("ok");
  });

  it("fails open to 'ok' when the RPC returns an unrecognized value", async () => {
    const supabase = stubSupabase({ data: "something-unexpected", error: null });
    await expect(getNodeAccessReason(supabase, "Finanzas")).resolves.toBe("ok");
  });

  it("returns 'ok' without calling the RPC when unitCode is empty", async () => {
    const supabase = stubSupabase({ data: "ok", error: null });
    const reason = await getNodeAccessReason(supabase, "   ");
    expect(reason).toBe("ok");
    expect(supabase.schema).not.toHaveBeenCalled();
  });
});
