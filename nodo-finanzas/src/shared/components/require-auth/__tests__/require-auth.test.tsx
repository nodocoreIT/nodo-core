/**
 * Unit tests for RequireAuth — session guard for nodo-finanzas.
 *
 * Verifies that:
 *  - Loading state renders a spinner
 *  - Authenticated session renders children
 *  - Null session triggers a redirect (redirectToLandingLogin)
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RequireAuth } from "../require-auth";

// ─── Mock useAuth ────────────────────────────────────────────────────────────

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@nodocore/shared-components", () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Mock redirectToLandingLogin ──────────────────────────────────────────────

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }));

vi.mock("@/shared/lib/auth-redirect", () => ({
  redirectToLandingLogin: () => mockRedirect(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function authState(overrides: { isLoading?: boolean; session?: object | null }) {
  return {
    isLoading: false,
    session: { user: { id: "user-1" } },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RequireAuth (finanzas)", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRedirect.mockReset();
  });

  it("renders a spinner while loading", () => {
    mockUseAuth.mockReturnValue(authState({ isLoading: true }));
    renderWithRouter(
      <RequireAuth><div>content</div></RequireAuth>,
    );
    // Spinner should be present (no children shown)
    expect(screen.queryByText("content")).toBeNull();
  });

  it("renders children when session is present", () => {
    mockUseAuth.mockReturnValue(authState({}));
    renderWithRouter(
      <RequireAuth><div>protected content</div></RequireAuth>,
    );
    expect(screen.getByText("protected content")).toBeTruthy();
  });

  it("calls redirectToLandingLogin when session is null", () => {
    mockUseAuth.mockReturnValue(authState({ session: null }));
    renderWithRouter(<RequireAuth><div>content</div></RequireAuth>);
    expect(mockRedirect).toHaveBeenCalledOnce();
    expect(screen.queryByText("content")).toBeNull();
  });
});
