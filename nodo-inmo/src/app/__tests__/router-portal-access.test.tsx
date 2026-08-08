/**
 * Regression test for a critical access-control bug: /admin, /owner and
 * /tenant were guarded by a local RequireAuth that only checked "is there
 * a session and a role", not "is it the RIGHT role" — so a tenant/owner
 * session could reach the admin portal by navigating to the URL directly.
 * Fixed by wiring @nodocore/shared-components' RequireAuth (which supports
 * allowedRoles) with per-portal role lists in router.tsx.
 *
 * Uses the real AuthProvider + RequireAuth (only the Supabase client is
 * mocked) so the actual allowedRoles gate runs, not a stubbed useAuth().
 */
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, SupabaseProvider, RequireAuth } from "@nodocore/shared-components";

/** Encodes a JWT payload into a base64url string for test JWTs. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.sig`;
}

/** Mock client for a user with node access but no org_members row (a pure
 * client_units customer — e.g. a tenant/owner registered through nodo-inmo's
 * own signup, exactly the account type involved in the reported incident). */
function makeSupabaseMock(role: string) {
  const accessToken = makeJwt({ sub: "user-1", app_metadata: { role, org_id: null } });
  const session = { access_token: accessToken, user: { id: "user-1", email: "test@inmo.com" } };

  const rpc = vi.fn().mockImplementation((fn: string) => {
    if (fn === "user_has_node_access") return Promise.resolve({ data: true, error: null });
    if (fn === "user_node_access_reason") return Promise.resolve({ data: "ok", error: null });
    if (fn === "user_node_role") return Promise.resolve({ data: [], error: null }); // no team-membership row
    return Promise.resolve({ data: null, error: null });
  });

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    schema: vi.fn().mockReturnValue({ rpc }),
  };
}

const AUTH_CONFIG = {
  roleDestinations: { admin: "/admin", owner: "/owner", tenant: "/tenant" },
  unitCode: "Inmo",
};

function renderGuardedAdminRoute(client: ReturnType<typeof makeSupabaseMock>) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <SupabaseProvider client={client as never}>
        <AuthProvider config={AUTH_CONFIG}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RequireAuth allowedRoles={["super_admin", "admin", "agent"]}>
                  <div>Admin Portal Content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AuthProvider>
      </SupabaseProvider>
    </MemoryRouter>,
  );
}

describe("RequireAuth allowedRoles (portal cross-access guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks a tenant session from reaching the admin portal", async () => {
    await act(async () => renderGuardedAdminRoute(makeSupabaseMock("tenant")));
    expect(screen.queryByText("Admin Portal Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("blocks an owner session from reaching the admin portal", async () => {
    await act(async () => renderGuardedAdminRoute(makeSupabaseMock("owner")));
    expect(screen.queryByText("Admin Portal Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("allows an admin session to reach the admin portal", async () => {
    await act(async () => renderGuardedAdminRoute(makeSupabaseMock("admin")));
    expect(screen.getByText("Admin Portal Content")).toBeInTheDocument();
  });
});
