import { createBrowserClient } from "@supabase/ssr";
import { getNodoAuthCode, getNodoPublicAuthConfig } from "@/lib/supabase/nodo-auth-config";
import { createClient } from "@/lib/supabase/client";

const nodeClients = new Map<string, ReturnType<typeof createBrowserClient>>();

/** Browser Supabase client for node login (auth only — no nodo_core schema). */
export function createNodeBrowserClient(nodeSlug: string) {
  const authCode = getNodoAuthCode(nodeSlug);
  if (!authCode) return createClient();

  const cfg = getNodoPublicAuthConfig(authCode);
  if (!cfg) return createClient();

  const landingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (cfg.url === landingUrl) return createClient();

  const cacheKey = `${cfg.url}:${cfg.anonKey}`;
  const cached = nodeClients.get(cacheKey);
  if (cached) return cached;

  const client = createBrowserClient(cfg.url, cfg.anonKey);
  nodeClients.set(cacheKey, client);
  return client;
}
