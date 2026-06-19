import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getNodoPublicAuthConfig } from "@/lib/supabase/nodo-auth-config";
import { createClient } from "@/lib/supabase/server";

/** Server Supabase client for a nodo auth project (recovery / confirm routes). */
export async function createNodoServerClient(authCode: string) {
  const cfg = getNodoPublicAuthConfig(authCode);
  if (!cfg) return createClient();

  const landingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (cfg.url === landingUrl) return createClient();

  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component — ignore */
        }
      },
    },
  });
}
