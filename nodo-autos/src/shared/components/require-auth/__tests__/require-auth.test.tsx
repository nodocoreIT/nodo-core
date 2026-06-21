/**
 * Unit tests for RequireAuth — JWT role guard.
 *
 * Verifies that:
 *  - Loading state renders nothing
 *  - Unauthenticated user is redirected to /login
 *  - Each valid JWT role grants access
 *  - An invalid/unknown role shows the "Acceso pendiente" screen
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RequireAuth } from "../require-auth";

// ─── Mock useAuth ────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("@nodocore/shared-components", () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function authState(overrides: { isLoading?: boolean; session?: object | null; role?: string | null }) {
  return {
    isLoading: false,
    session: { user: { id: "user-1" } },
    role: "admin",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RequireAuth", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue(authState({ isLoading: true }));
    const { container } = renderWithRouter(
      <RequireAuth><div>content</div></RequireAuth>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("redirects to /login when session is null", () => {
    mockUseAuth.mockReturnValue(authState({ session: null, role: null }));
    renderWithRouter(<RequireAuth><div>content</div></RequireAuth>);
    // Navigate renders nothing visible; confirm children are NOT shown.
    expect(screen.queryByText("content")).toBeNull();
  });

  it.each([
    ["super_admin"],
    ["admin"],
    ["seller"],
    ["guest"],
  ])("grants access for role: %s", (role) => {
    mockUseAuth.mockReturnValue(authState({ role }));
    renderWithRouter(
      <RequireAuth><div>protected content</div></RequireAuth>,
    );
    expect(screen.getByText("protected content")).toBeTruthy();
  });

  it("shows acceso pendiente screen for unknown role", () => {
    mockUseAuth.mockReturnValue(authState({ role: "administrador" }));
    renderWithRouter(<RequireAuth><div>content</div></RequireAuth>);
    expect(screen.getByText("Acceso pendiente")).toBeTruthy();
    expect(screen.queryByText("content")).toBeNull();
  });

  it("shows acceso pendiente screen when role is null (no org_member row)", () => {
    mockUseAuth.mockReturnValue(authState({ role: null }));
    renderWithRouter(<RequireAuth><div>content</div></RequireAuth>);
    expect(screen.getByText("Acceso pendiente")).toBeTruthy();
  });
});
