import { createBrowserClient } from "@supabase/ssr";
import { panelSupabaseClientOptions } from "@/lib/supabase/panel-auth";

function createBrowserClientInstance() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    panelSupabaseClientOptions,
  );
}

let browserClient: ReturnType<typeof createBrowserClientInstance> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClientInstance();
  }
  return browserClient;
}
