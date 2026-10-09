import { describe, expect, it, vi } from "vitest";
import { acceptPendingInvitations } from "../accept-pending-invitations";

describe("acceptPendingInvitations", () => {
  it("accepts every pending token for the current session", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const rpc = vi.fn().mockResolvedValue({
      data: [{ token: "t-1" }, { token: "t-2" }],
      error: null,
    });
    await acceptPendingInvitations({
      rpc,
      functions: { invoke },
    } as never);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith("accept-invitation", {
      body: { token: "t-1", action: "accept" },
    });
  });

  it("does nothing when there are no pending invites", async () => {
    const invoke = vi.fn();
    await acceptPendingInvitations({
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      functions: { invoke },
    } as never);
    expect(invoke).not.toHaveBeenCalled();
  });
});
