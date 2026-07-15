/**
 * Returns a Supabase browser client scoped to the nodo_ecommerce schema.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createEcommerceBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "nodo_ecommerce" } }
  );
}
