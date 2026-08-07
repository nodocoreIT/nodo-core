"use client";

import type { ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { createClient } from "@/lib/supabase/client";
import { PanelSettingsModuleProvider } from "@/lib/panel/panel-settings-module";
import { UnreadFeedbackCountProvider } from "@/hooks/use-unread-feedback-count";
import { PendingSolicitudesCountProvider } from "@/hooks/use-pending-solicitudes-count";

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
        <PanelSettingsModuleProvider>
          <UnreadFeedbackCountProvider>
            <PendingSolicitudesCountProvider>
              {children}
            </PendingSolicitudesCountProvider>
          </UnreadFeedbackCountProvider>
        </PanelSettingsModuleProvider>
      </AuthProvider>
    </SupabaseProvider>
  );
}
