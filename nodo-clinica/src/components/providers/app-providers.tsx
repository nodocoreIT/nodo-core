"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { CLINICA_AUTH_CONFIG, isPlatformMode } from "@/lib/clinic/platform-config";

function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  return (
    <SupabaseProvider client={supabase}>
      <AuthProvider config={CLINICA_AUTH_CONFIG}>{children}</AuthProvider>
    </SupabaseProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );

  if (!isPlatformMode()) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformAuthProvider>{children}</PlatformAuthProvider>
    </QueryClientProvider>
  );
}
