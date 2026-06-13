import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service_role key.
//
// SECURITY: the service_role key bypasses Row Level Security. NEVER import this
// from a Client Component or any "use client" file — it must only run on the
// server (Route Handlers, Server Actions, server-only modules). The key lives in
// SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix, so it is never sent to the
// browser).
export function createAdminClient(schema: string = "nodo_core") {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
