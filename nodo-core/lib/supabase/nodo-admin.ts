import { createClient } from "@supabase/supabase-js";

// Server-only factory — creates an admin Supabase client for a target nodo's
// separate Supabase project. NEVER import from a Client Component.
//
// Each nodo that supports provisioning needs two env vars:
//   NODO_<CODE>_SUPABASE_URL
//   NODO_<CODE>_SERVICE_ROLE_KEY

interface NodoConfig {
  url: string;
  serviceRoleKey: string;
}

function getNodoConfig(nodoCode: string): NodoConfig | null {
  switch (nodoCode.toLowerCase()) {
    case "inmo":
      if (!process.env.NODO_INMO_SUPABASE_URL || !process.env.NODO_INMO_SERVICE_ROLE_KEY) {
        return null;
      }
      return {
        url: process.env.NODO_INMO_SUPABASE_URL,
        serviceRoleKey: process.env.NODO_INMO_SERVICE_ROLE_KEY,
      };
    default:
      return null;
  }
}

export function createNodoAdminClient(nodoCode: string) {
  const config = getNodoConfig(nodoCode);
  if (!config) return null;
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
