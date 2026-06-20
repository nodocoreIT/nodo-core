import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import {
  SupabaseProvider,
  AuthProvider,
  mergeThemeSettings,
} from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { useThemeSettings, useThemeStore, DEFAULT_SETTINGS } from "@/shared/hooks/use-theme-settings";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

const AUTH_CONFIG = {
  roleDestinations: {
    super_admin: "/admin",
    admin: "/admin",
    agent: "/admin",
    owner: "/owner",
    tenant: "/tenant",
  },
  unitCode: "Inmo",
  allowedRoles: ["super_admin", "admin", "agent", "owner", "tenant"],
};

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeInitializer({ children }: { children: ReactNode }) {
  const { setSettings } = useThemeStore();
  const { data: profile } = useOrgProfile();

  // Sync theme from Supabase when the org profile loads.
  // Supabase wins over localStorage so all admins share the same branding.
  useEffect(() => {
    if (profile === undefined) return;
    const theme = mergeThemeSettings(profile?.theme_settings, DEFAULT_SETTINGS);
    setSettings(theme);
  }, [profile, setSettings]);

  // Apply CSS custom properties to :root from the Zustand store.
  useThemeSettings();

  return <>{children}</>;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <AuthProvider config={AUTH_CONFIG}>
          <ThemeInitializer>{children}</ThemeInitializer>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
