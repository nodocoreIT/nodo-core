import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  SupabaseProvider,
  AuthProvider,
} from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import { useThemeSettings } from "@/shared/hooks/use-theme-settings";

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
    admin: "/admin",
    agent: "/admin",
    owner: "/owner",
    tenant: "/tenant",
  },
};

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeInitializer({ children }: { children: ReactNode }) {
  // Boot up theme customization variables on mount
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
