"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SupabaseProvider, AuthProvider, SessionTimeoutGuard } from "@nodocore/shared-components";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";
import { CLINICA_AUTH_CONFIG } from "@/lib/clinic/platform-config";

function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  return (
    <SupabaseProvider client={supabase}>
      {/* Outside AuthProvider on purpose: AuthProvider's allowedRoles here only
          covers médico/staff roles (see CLINICA_AUTH_CONFIG), so a paciente
          session would read as accessDenied inside it — but pacientes still
          hold a real Supabase session that should time out the same way. */}
      <SessionTimeoutGuard loginPath="/login" storageKeyPrefix="nodo_clinica_session" />
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

  const shell = (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  if (!isBrowserSupabaseEnabled()) {
    return shell;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformAuthProvider>{children}</PlatformAuthProvider>
    </QueryClientProvider>
  );
}
