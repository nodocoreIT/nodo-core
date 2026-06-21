/**
 * Unit tests for FinanzasSettingsModuleProvider configuration.
 *
 * Verifies that:
 *  - roleOptions contains exactly super_admin and member
 *  - adminRole is "super_admin"
 *  - defaultInviteRole is "member"
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useSettingsModule } from "@nodocore/nodo-modules/settings";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@nodocore/shared-components", () => ({
  useAuth: () => ({ user: null, session: null, role: "super_admin", isLoading: false }),
}));

vi.mock("@/shared/hooks/use-theme-settings", () => ({
  useThemeSettings: () => ({ settings: {}, setSettings: vi.fn(), resetSettings: vi.fn() }),
}));

vi.mock("@/hooks/use-ai-settings", () => ({
  useAiSettings: () => ({ aiSettings: {}, setAiSettings: vi.fn() }),
}));

vi.mock("@/shared/hooks/use-finanzas-staff", () => ({
  useFinanzasStaff: () => ({
    users: [],
    loading: false,
    error: null,
    fetchMembers: vi.fn(),
    inviteUser: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  }),
}));

vi.mock("@/shared/lib/supabase", () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

// ─── Consumer component ───────────────────────────────────────────────────────

import { FinanzasSettingsModuleProvider } from "../finanzas-settings-module";

function SettingsConsumer() {
  const ctx = useSettingsModule();
  return (
    <div>
      <span data-testid="adminRole">{ctx.adminRole}</span>
      <span data-testid="defaultInviteRole">{ctx.defaultInviteRole}</span>
      {ctx.roleOptions.map((opt) => (
        <span key={opt.value} data-testid={`role-${opt.value}`}>{opt.label}</span>
      ))}
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FinanzasSettingsModuleProvider", () => {
  it("sets adminRole to 'super_admin'", () => {
    render(
      <FinanzasSettingsModuleProvider>
        <SettingsConsumer />
      </FinanzasSettingsModuleProvider>,
    );
    expect(screen.getByTestId("adminRole").textContent).toBe("super_admin");
  });

  it("sets defaultInviteRole to 'member'", () => {
    render(
      <FinanzasSettingsModuleProvider>
        <SettingsConsumer />
      </FinanzasSettingsModuleProvider>,
    );
    expect(screen.getByTestId("defaultInviteRole").textContent).toBe("member");
  });

  it("roleOptions contains exactly super_admin and member", () => {
    render(
      <FinanzasSettingsModuleProvider>
        <SettingsConsumer />
      </FinanzasSettingsModuleProvider>,
    );
    // member role must be present
    expect(screen.getByTestId("role-member")).toBeTruthy();
    // super_admin is adminRole, not in roleOptions (it's not an invite target)
    // seller/guest from other nodos must NOT be present
    expect(screen.queryByTestId("role-seller")).toBeNull();
    expect(screen.queryByTestId("role-guest")).toBeNull();
    expect(screen.queryByTestId("role-agent")).toBeNull();
  });

  it("roleOptions does NOT include seller or guest", () => {
    render(
      <FinanzasSettingsModuleProvider>
        <SettingsConsumer />
      </FinanzasSettingsModuleProvider>,
    );
    expect(screen.queryByTestId("role-seller")).toBeNull();
    expect(screen.queryByTestId("role-guest")).toBeNull();
  });
});
