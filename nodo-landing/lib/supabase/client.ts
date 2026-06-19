import { createBrowserClient } from "@supabase/ssr";

function createBrowserClientInstance() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "nodo_core" },
    },
  );
}

let browserClient: ReturnType<typeof createBrowserClientInstance> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClientInstance();
  }
  return browserClient;
}
