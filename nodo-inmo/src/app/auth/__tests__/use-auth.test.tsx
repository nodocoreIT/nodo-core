/**
 * TDD — useAuth hook (via @nodocore/shared-components)
 * Tests: session, role, orgId, isLoading transitions, signOut,
 *        signInWithPassword, onAuthStateChange reactivity, subscription cleanup.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session, User, AuthChangeEvent, SupabaseClient } from "@supabase/supabase-js";
import { AuthProvider, SupabaseProvider, useAuth } from "@nodocore/shared-components";

// ── Mocked Supabase client ────────────────────────────────────────────────────

const mockAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

const mockClient = { auth: mockAuth } as unknown as SupabaseClient;

const testConfig = {
  roleDestinations: { admin: "/admin", owner: "/owner", tenant: "/tenant" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function asSubscriptionReturn(unsubscribeFn: ReturnType<typeof vi.fn>) {
  return {
    data: {
      subscription: { unsubscribe: unsubscribeFn, id: "sub-1" } as unknown as ReturnType<
        typeof mockAuth.onAuthStateChange
      >["data"]["subscription"],
    },
  };
}

/**
 * Build a fake JWT whose payload encodes app_metadata claims.
 * useAuth reads role/orgId from the decoded access_token — NOT from
 * user.app_metadata, which may be stale.
 */
function fakeJwt(appMetadata: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify({ app_metadata: appMetadata }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${b64}.sig`;
}

function makeUser(): User {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "test@nodo.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  } as User;
}

function makeSession(
  appMetadata: Record<string, unknown> = { role: "admin", org_id: "org-abc" },
): Session {
  return {
    access_token: fakeJwt(appMetadata),
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: makeUser(),
  } as Session;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider client={mockClient}>
      <AuthProvider config={testConfig}>{children}</AuthProvider>
    </SupabaseProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state then resolves session", async () => {
    const session = makeSession();

    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(vi.fn()));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toEqual(session);
    expect(result.current.user).toEqual(session.user);
    expect(result.current.role).toBe("admin");
    expect(result.current.orgId).toBe("org-abc");
  });

  it("exposes null role and orgId when app_metadata is empty", async () => {
    const session = makeSession({});

    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(vi.fn()));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.role).toBeNull();
    expect(result.current.orgId).toBeNull();
  });

  it("resolves to null session when unauthenticated", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(vi.fn()));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("signOut delegates to supabase.auth.signOut", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(vi.fn()));
    mockAuth.signOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.signOut(); });

    expect(mockAuth.signOut).toHaveBeenCalledOnce();
  });

  it("signInWithPassword delegates to supabase.auth.signInWithPassword", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(vi.fn()));
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signInWithPassword({ email: "test@nodo.com", password: "pass" });
    });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@nodo.com",
      password: "pass",
    });
  });

  it("reacts to onAuthStateChange events (sign-in after mount)", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    let capturedCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
    mockAuth.onAuthStateChange.mockImplementation((cb: typeof capturedCallback) => {
      capturedCallback = cb;
      return asSubscriptionReturn(vi.fn());
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();

    const newSession = makeSession();
    act(() => { capturedCallback!("SIGNED_IN", newSession); });

    expect(result.current.session).toEqual(newSession);
    expect(result.current.role).toBe("admin");
  });

  it("cleans up subscription on unmount", async () => {
    const unsubscribe = vi.fn();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue(asSubscriptionReturn(unsubscribe));

    const { unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {});

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
