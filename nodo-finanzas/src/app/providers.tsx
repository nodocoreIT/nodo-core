import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { useThemeSettings, useThemeStore } from "@/shared/hooks/use-theme-settings";
import { useFinanzasThemeSync } from "@/shared/hooks/use-finanzas-theme-sync";

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
    super_admin: "/admin/dashboard",
    member: "/admin/dashboard",
  },
  unitCode: "Finanzas",
  allowedRoles: ["super_admin", "member"],
};

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeInitializer({ children }: { children: ReactNode }) {
  useFinanzasThemeSync();
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
