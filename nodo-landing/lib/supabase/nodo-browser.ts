import { createNodoAuthClient } from "@nodocore/shared-components/lib/create-nodo-auth-client";
import { normalizeNodeSlug } from "@/lib/nodes";
import { getNodoAuthCode, getNodoPublicAuthConfig } from "@/lib/supabase/nodo-auth-config";

const nodeClients = new Map<string, ReturnType<typeof createNodoAuthClient>>();

/**
 * Browser Supabase client for nodo login pages on the landing host.
 * Always uses nodo-specific localStorage (never panel cookies).
 */
export function createNodeBrowserClient(nodeSlug: string) {
  const authCode = getNodoAuthCode(nodeSlug);
  const storageSlug = authCode?.toLowerCase() ?? normalizeNodeSlug(nodeSlug) ?? "unknown";

  const cfg = authCode ? getNodoPublicAuthConfig(authCode) : null;
  const url = cfg?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = cfg?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public env vars for nodo login.");
  }

  const cacheKey = `${url}:${anonKey}:${storageSlug}`;
  const cached = nodeClients.get(cacheKey);
  if (cached) return cached;

  const client = createNodoAuthClient(url, anonKey, storageSlug);
  nodeClients.set(cacheKey, client);
  return client;
}
