import { toSlug } from "@/features/categories/lib/slug";
import { supabase } from "@/shared/lib/supabase";

/** Ensures nodo_tienda.stores exists so the public storefront can resolve the slug. */
export async function ensureStoreForOrg(orgId: string, storeName: string): Promise<void> {
  const name = storeName.trim() || "Mi Tienda";
  const slug = toSlug(name) || "mi-tienda";

  const { data: existing, error: lookupErr } = await supabase
    .schema("nodo_tienda")
    .from("stores")
    .select("id, slug")
    .eq("org_id", orgId)
    .maybeSingle();

  if (lookupErr) throw lookupErr;

  if (existing) {
    const { error } = await supabase
      .schema("nodo_tienda")
      .from("stores")
      .update({ name, is_active: true })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.schema("nodo_tienda").from("stores").insert({
    org_id: orgId,
    slug,
    name,
    is_active: true,
  });

  if (error) throw error;
}
