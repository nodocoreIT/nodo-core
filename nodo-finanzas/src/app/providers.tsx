import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { SupabaseProvider, AuthProvider, SessionTimeoutGuard } from "@nodocore/shared-components";
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
    // Self-registered Finanzas customers get role "user" (see the node
    // registration flow + custom_access_token_hook). Finanzas is multi-tenant
    // per user_id — every client manages their own finances in the same admin
    // panel — so "user" is a first-class role here and must be allowed in, not
    // just super_admin/member. Omitting it made AuthProvider mark every
    // self-signup client accessDenied and bounce them straight back to login.
    user: "/admin/dashboard",
  },
  unitCode: "Finanzas",
  allowedRoles: ["super_admin", "member", "user"],
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
        <SessionTimeoutGuard loginPath="/login" storageKeyPrefix="nodo_finanzas_session" />
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
