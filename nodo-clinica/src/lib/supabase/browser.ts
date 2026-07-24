import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { clinicaSupabaseClientOptions } from "@/lib/supabase/clinica-auth";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL y ANON_KEY requeridos");
  }

  // @supabase/ssr's createBrowserClient caches a single client in a
  // module-level singleton, shared across the whole bundle regardless of
  // which wrapper calls it first. Without this schema option here, this
  // being the first call on most pages (via the root PlatformAuthProvider)
  // would lock every other createClient() call — including the ones that
  // do pass nodo_clinica — into the default "public" schema instead.
  browserClient = createBrowserClient<Database>(
    url,
    key,
    clinicaSupabaseClientOptions,
  );
  return browserClient;
}
