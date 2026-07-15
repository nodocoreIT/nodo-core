"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useMemo, type ReactNode } from "react";
import { SupabaseProvider, AuthProvider } from "@nodocore/shared-components";
import { createBrowserClient } from "@supabase/ssr";
import { CLINICA_AUTH_CONFIG } from "@/lib/clinic/platform-config";

/**
 * Detect Supabase env vars at RUNTIME (not build time) so the providers
 * are always mounted when the browser has access to the public keys.
 * NEXT_PUBLIC_ vars are inlined at build time, but using explicit window
 * check ensures we never skip providers due to a stale build cache.
 */
function useSupabaseClient() {
  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);
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

  const supabase = useSupabaseClient();

  if (!supabase) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <AuthProvider config={CLINICA_AUTH_CONFIG}>{children}</AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}
