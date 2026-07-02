import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { clinicaSupabaseClientOptions } from "@/lib/supabase/clinica-auth";

function createBrowserClientInstance() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    clinicaSupabaseClientOptions,
  );
}

let browserClient: ReturnType<typeof createBrowserClientInstance> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClientInstance();
  }
  return browserClient;
}
