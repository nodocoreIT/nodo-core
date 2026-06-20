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

function envPair(prefix: string): NodoConfig | null {
  const url = process.env[`${prefix}_SUPABASE_URL`];
  const key = process.env[`${prefix}_SERVICE_ROLE_KEY`];
  if (url && key) return { url, serviceRoleKey: key };
  return null;
}

function getNodoConfig(nodoCode: string): NodoConfig | null {
  switch (nodoCode.toLowerCase()) {
    case "inmo":
      return envPair("NODO_INMO");
    case "autos":
      return envPair("NODO_AUTOS");
    case "salud":
    case "clínica":
    case "clinica":
      return envPair("NODO_CLINICA") ?? envPair("NODO_SALUD");
    case "finanzas":
      return envPair("NODO_FINANZAS");
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
