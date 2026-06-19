"use client";

import type { ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { createClient } from "@/lib/supabase/client";
import { PanelSettingsModuleProvider } from "@/lib/panel/panel-settings-module";

const PANEL_AUTH_CONFIG = {
  roleDestinations: {
    admin: "/panel",
    dev: "/panel",
    designer: "/panel",
    manager: "/panel",
  },
};

export function PanelProviders({ children }: { children: ReactNode }) {
  const supabase = createClient();

  return (
    <SupabaseProvider client={supabase}>
      <AuthProvider config={PANEL_AUTH_CONFIG}>
        <PanelSettingsModuleProvider>{children}</PanelSettingsModuleProvider>
      </AuthProvider>
    </SupabaseProvider>
  );
}
