import { createSupabaseAdmin } from "./supabase";

export type CategoryData = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

export async function getCategories(orgId: string): Promise<CategoryData[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .schema("nodo_tienda")
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");
  return data ?? [];
}
