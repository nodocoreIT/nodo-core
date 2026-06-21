/**
 * Unit tests for useAutosStaff — EF integration.
 *
 * Verifies that:
 *  - fetchMembers passes products: ['nodo-autos'] to list-org-members
 *  - inviteUser passes products: ['nodo-autos'] and nodeLabel: 'Autos' to invite-member
 *  - inviteUser passes the DB role directly (not a display label) to avoid mapping collision
 *  - updateMemberRole passes products: ['nodo-autos'] to update-org-member-role
 *  - removeMember passes products: ['nodo-autos'] to remove-org-member
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@/shared/lib/supabase", () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: "admin@test.com", user_metadata: {} } },
      }),
    },
  },
}));

// ─── System under test ────────────────────────────────────────────────────────

import { useAutosStaffStore } from "../use-autos-staff";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function successInvoke(data: Record<string, unknown>) {
  mockInvoke.mockResolvedValueOnce({ data, error: null });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useAutosStaff EF integration", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Reset store state between tests
    useAutosStaffStore.setState({ users: [], loading: false, error: null });
  });

  it("fetchMembers calls list-org-members with products: ['nodo-autos']", async () => {
    successInvoke({ members: [] });

    await useAutosStaffStore.getState().fetchMembers();

    expect(mockInvoke).toHaveBeenCalledWith("list-org-members", {
      body: { products: ["nodo-autos"] },
    });
  });

  it("inviteUser calls invite-member with products and nodeLabel", async () => {
    // First call: invite-member
    successInvoke({ id: "new-user-id", invited: true });
    // Second call: fetchMembers triggered by inviteUser
    successInvoke({ members: [] });

    await useAutosStaffStore.getState().inviteUser("Jane Doe", "jane@test.com", "seller");

    const [efName, options] = mockInvoke.mock.calls[0];
    expect(efName).toBe("invite-member");
    expect(options.body.products).toEqual(["nodo-autos"]);
    expect(options.body.nodeLabel).toBe("Autos");
    expect(options.body.role).toBe("seller"); // DB role, not display label "Vendedor"
    expect(options.body.email).toBe("jane@test.com");
  });

  it("inviteUser passes DB role directly — not a display label", async () => {
    successInvoke({ id: "new-user-id", invited: true });
    successInvoke({ members: [] });

    await useAutosStaffStore.getState().inviteUser("Guest User", "guest@test.com", "guest");

    const [, options] = mockInvoke.mock.calls[0];
    // Must be "guest" (DB role), not "Invitado" (display label)
    expect(options.body.role).toBe("guest");
  });

  it("updateMemberRole calls update-org-member-role with products: ['nodo-autos']", async () => {
    successInvoke({});

    await useAutosStaffStore.getState().updateMemberRole("user-123", "seller");

    expect(mockInvoke).toHaveBeenCalledWith("update-org-member-role", {
      body: { userId: "user-123", role: "seller", products: ["nodo-autos"] },
    });
  });

  it("removeMember calls remove-org-member with products: ['nodo-autos']", async () => {
    useAutosStaffStore.setState({
      users: [{ id: "user-123", name: "Test", email: "t@t.com", role: "seller", status: "Activo" }],
    });
    successInvoke({});

    await useAutosStaffStore.getState().removeMember("user-123");

    expect(mockInvoke).toHaveBeenCalledWith("remove-org-member", {
      body: { userId: "user-123", products: ["nodo-autos"] },
    });
    expect(useAutosStaffStore.getState().users).toHaveLength(0);
  });
});
