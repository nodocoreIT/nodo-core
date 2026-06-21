/**
 * Unit tests for AutosSettingsModuleProvider configuration.
 *
 * Verifies that:
 *  - roleOptions does NOT include "marketing"
 *  - adminRole is the JWT role "admin" (not the legacy DB "administrador")
 *  - defaultInviteRole is "guest"
 *  - roleOptions contains seller and guest
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useSettingsModule } from "@nodocore/nodo-modules/settings";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@nodocore/shared-components", () => ({
  useAuth: () => ({ user: null, session: null, role: "admin", isLoading: false }),
}));

vi.mock("@/shared/hooks/use-theme-settings", () => ({
  useThemeSettings: () => ({ settings: {}, setSettings: vi.fn(), resetSettings: vi.fn() }),
}));

vi.mock("@/shared/hooks/use-autos-ai-settings", () => ({
  useAutosAiSettings: () => ({ aiSettings: {}, setAiSettings: vi.fn() }),
}));

vi.mock("@/shared/hooks/use-autos-staff", () => ({
  useAutosStaff: () => ({
    users: [],
    loading: false,
    error: null,
    fetchMembers: vi.fn(),
    inviteUser: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  }),
}));

vi.mock("@/shared/hooks/use-autos-bank-accounts", () => ({
  useAutosBankAccounts: () => ({
    accounts: [],
    isLoading: false,
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    removeAccount: vi.fn(),
    isAdding: false,
    isUpdating: false,
    isRemoving: false,
  }),
}));

vi.mock("@/shared/lib/autos-module-hooks", () => ({
  autosTenantProfileHooks: {
    useTenantProfile: () => ({ data: null, isLoading: false }),
    useUpsertTenantProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  },
  autosLogoHooks: {
    useUploadLogo: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useLogoSignedUrl: () => ({ data: null }),
  },
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

import { AutosSettingsModuleProvider } from "../autos-settings-module";

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

describe("AutosSettingsModuleProvider", () => {
  it("sets adminRole to 'admin' (JWT role, not legacy DB role)", () => {
    render(
      <AutosSettingsModuleProvider>
        <SettingsConsumer />
      </AutosSettingsModuleProvider>,
    );
    expect(screen.getByTestId("adminRole").textContent).toBe("admin");
  });

  it("sets defaultInviteRole to 'guest'", () => {
    render(
      <AutosSettingsModuleProvider>
        <SettingsConsumer />
      </AutosSettingsModuleProvider>,
    );
    expect(screen.getByTestId("defaultInviteRole").textContent).toBe("guest");
  });

  it("roleOptions contains seller and guest", () => {
    render(
      <AutosSettingsModuleProvider>
        <SettingsConsumer />
      </AutosSettingsModuleProvider>,
    );
    expect(screen.getByTestId("role-seller")).toBeTruthy();
    expect(screen.getByTestId("role-guest")).toBeTruthy();
  });

  it("roleOptions does NOT include marketing", () => {
    render(
      <AutosSettingsModuleProvider>
        <SettingsConsumer />
      </AutosSettingsModuleProvider>,
    );
    expect(screen.queryByTestId("role-Marketing")).toBeNull();
    expect(screen.queryByTestId("role-marketing")).toBeNull();
  });
});
