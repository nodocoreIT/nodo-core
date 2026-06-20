import { createSupabaseAdmin } from "./supabase";

type ProductImage = { url: string; alt: string | null; sort_order: number };

export type ProductWithImages = {
  id: string;
  name: string;
  slug: string;
  price: number;
  promotional_price: number | null;
  description: string | null;
  images: { url: string; alt: string | null }[] | null;
};

function mapImages(
  raw: ProductImage[] | null | undefined,
): { url: string; alt: string | null }[] | null {
  if (!raw) return null;
  return raw.slice().sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFeaturedProducts(
  orgId: string,
  opts?: { limit?: number },
): Promise<ProductWithImages[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .schema("nodo_tienda")
    .from("products")
    .select(
      "id, name, slug, price, promotional_price, description, product_images(url, alt, sort_order)",
    )
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_featured", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 8);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    promotional_price: p.promotional_price,
    description: p.description,
    images: mapImages(p.product_images as ProductImage[]),
  }));
}

export async function getProducts(
  orgId: string,
  opts?: { categorySlug?: string; search?: string },
): Promise<ProductWithImages[]> {
  const admin = createSupabaseAdmin();
  let query = admin
    .schema("nodo_tienda")
    .from("products")
    .select(
      "id, name, slug, price, promotional_price, description, product_images(url, alt, sort_order)",
    )
    .eq("org_id", orgId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (opts?.search) {
    query = query.ilike("name", `%${opts.search}%`);
  }

  const { data } = await query;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    promotional_price: p.promotional_price,
    description: p.description,
    images: mapImages(p.product_images as ProductImage[]),
  }));
}

export async function getProductBySlug(
  orgId: string,
  slug: string,
): Promise<ProductWithImages | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .schema("nodo_tienda")
    .from("products")
    .select(
      "id, name, slug, price, promotional_price, description, product_images(url, alt, sort_order)",
    )
    .eq("org_id", orgId)
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    price: data.price,
    promotional_price: data.promotional_price,
    description: data.description,
    images: mapImages(data.product_images as ProductImage[]),
  };
}
