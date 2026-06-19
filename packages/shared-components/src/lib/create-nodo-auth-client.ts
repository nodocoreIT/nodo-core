import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** localStorage key for a nodo SPA — keeps sessions independent across nodos on the same Supabase project. */
export function nodoAuthStorageKey(nodeSlug: string): string {
  return `nodo-auth-${nodeSlug.trim().toLowerCase()}`;
}

/**
 * Panel (nodo-landing /panel) uses SSR cookies named `nodo-auth-panel` instead.
 * Never use the landing panel client for nodo login — it would overwrite dashboard sessions.
 */
export function createNodoAuthClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  nodeSlug: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: nodoAuthStorageKey(nodeSlug),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
