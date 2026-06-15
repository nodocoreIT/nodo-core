import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { Toaster } from "sonner";
import { supabase } from "@/shared/lib/supabase";

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
};

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <AuthProvider config={AUTH_CONFIG}>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
