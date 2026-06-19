import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { Toaster } from "sonner";
import { supabase } from "@/shared/lib/supabase";
import { useThemeSettings, useThemeStore } from "@/shared/hooks/use-theme-settings";
import { useAutosThemeSync } from "@/shared/hooks/use-autos-theme-sync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

const AUTH_CONFIG = {
  roleDestinations: {
    administrador: "/admin",
    vendedor: "/admin",
    marketing: "/admin",
  },
  unitCode: "Autos",
};

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeInitializer({ children }: { children: ReactNode }) {
  // Load theme_settings from Supabase and sync into Zustand store.
  // Supabase wins over localStorage so all admins share the same branding.
  useAutosThemeSync();

  // Apply CSS custom properties to :root from the Zustand store.
  useThemeSettings();

  return <>{children}</>;
}

// Re-export store for consumers that need direct access
export { useThemeStore };

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <AuthProvider config={AUTH_CONFIG}>
          <ThemeInitializer>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeInitializer>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
