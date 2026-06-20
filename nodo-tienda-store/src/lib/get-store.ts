import { createSupabaseAdmin } from "./supabase";
import { cache } from "react";

export type StoreData = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
};

export const getStore = cache(
  async (slug: string): Promise<StoreData | null> => {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .schema("nodo_tienda")
      .from("stores")
      .select("id, org_id, slug, name, description, logo_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  },
);

/**
 * Custom-domain lookup used by middleware.
 * NOTE: React cache() does NOT work in middleware — this is a plain async
 * function so the middleware can call it directly.
 */
export async function getStoreByDomain(
  domain: string,
): Promise<{ slug: string } | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .schema("nodo_tienda")
    .from("stores")
    .select("slug")
    .eq("custom_domain", domain)
    .not("domain_verified_at", "is", null)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}
