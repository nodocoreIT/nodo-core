/**
 * Returns a Supabase server client scoped to the nodo_ecommerce schema.
 * RLS policies enforce org_id = auth.uid() automatically.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createEcommerceClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "nodo_ecommerce" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
