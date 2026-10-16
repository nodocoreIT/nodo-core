import { createClient } from "@supabase/supabase-js";

function inmoAdmin() {
  const url =
    process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_URL ?? process.env.NODO_INMO_SUPABASE_URL;
  const key = process.env.NODO_INMO_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signPaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

export async function loadPublicProperty(token: string) {
  const admin = inmoAdmin();
  if (!admin) return null;

  const { data: row, error } = await admin
    .schema("nodo_inmo")
    .from("properties")
    .select(
      "address, operation, property_type, status, sale_price, currency, total_sqm, rooms, bathrooms, description, localidad, provincia, has_pool, pets_allowed, has_garage, has_garden, has_laundry, has_bbq, has_elevator, has_parking, photos, main_photo, org_id",
    )
    .eq("share_token", token)
    .in("status", ["available", "reserved"])
    .maybeSingle();

  if (error || !row) return null;

  const { data: profile } = await admin
    .schema("nodo_inmo")
    .from("org_profiles")
    .select("legal_name, phone, email, logo_path, pdf_logo_path, theme_settings")
    .eq("org_id", row.org_id)
    .maybeSingle();

  const photoPaths: string[] =
    Array.isArray(row.photos) && row.photos.length > 0
      ? row.photos
      : row.main_photo
        ? [row.main_photo]
        : [];

  const photo_urls = await signPaths(admin, "property-photos", photoPaths);
  const logoPath = profile?.logo_path || profile?.pdf_logo_path || null;
  const logo_urls = logoPath ? await signPaths(admin, "org-branding", [logoPath]) : [];

  return {
    address: row.address,
    operation: row.operation,
    property_type: row.property_type,
    status: row.status,
    sale_price: row.sale_price,
    currency: row.currency,
    total_sqm: row.total_sqm,
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    description: row.description,
    localidad: row.localidad,
    provincia: row.provincia,
    has_pool: row.has_pool,
    pets_allowed: row.pets_allowed,
    has_garage: row.has_garage,
    has_garden: row.has_garden,
    has_laundry: row.has_laundry,
    has_bbq: row.has_bbq,
    has_elevator: row.has_elevator,
    has_parking: row.has_parking,
    photo_urls,
    theme_settings: profile?.theme_settings ?? null,
    agency: {
      legal_name: profile?.legal_name ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      logo_url: logo_urls[0] ?? null,
    },
  };
}
