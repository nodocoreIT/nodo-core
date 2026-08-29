"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SupabaseProvider, AuthProvider, SessionTimeoutGuard } from "@nodocore/shared-components";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";
import { CLINICA_AUTH_CONFIG, CLINICA_SESSION_STORAGE_KEY_PREFIX } from "@/lib/clinic/platform-config";

// Team-expected idle timeout for nodo-clinica is 30 min, not the shared
// SessionTimeoutGuard default of 20 min — that default is intentionally kept
// at 20 min for every other nodo sharing the component (PCI-DSS-adjacent
// rationale documented in session-timeout-guard.tsx's header, applying
// across every Nodo product on the same Supabase auth project), so it's
// overridden here rather than changed globally.
const CLINICA_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  return (
    <SupabaseProvider client={supabase}>
      {/* Outside AuthProvider on purpose: AuthProvider's allowedRoles here only
          covers médico/staff roles (see CLINICA_AUTH_CONFIG), so a paciente
          session would read as accessDenied inside it — but pacientes still
          hold a real Supabase session that should time out the same way. */}
      <SessionTimeoutGuard
        loginPath="/login"
        storageKeyPrefix={CLINICA_SESSION_STORAGE_KEY_PREFIX}
        idleTimeoutMs={CLINICA_IDLE_TIMEOUT_MS}
      />
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
