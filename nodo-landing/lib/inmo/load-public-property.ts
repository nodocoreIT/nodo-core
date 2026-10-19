import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { createClient } from "@supabase/supabase-js";

function inmoAdmin() {
  const fromPair = createNodoAdminClient("inmo");
  if (fromPair) return fromPair;
  const url =
    process.env.NODO_INMO_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_URL;
  const key =
    process.env.NODO_INMO_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadPublicProperty(token: string) {
  const admin = inmoAdmin() as any;
  if (!admin) return null;

  const { data, error } = await admin.rpc("get_public_property", {
    p_share_token: token,
  });

  if (error || !data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const photoPaths = Array.isArray(row.photo_paths) ? (row.photo_paths as string[]) : [];

  const photo_urls: string[] = [];
  for (const path of photoPaths) {
    if (!path) continue;
    const { data: signed } = await admin.storage.from("property-photos").createSignedUrl(path, 3600);
    if (signed?.signedUrl) photo_urls.push(signed.signedUrl);
  }

  const agencyIn = row.agency && typeof row.agency === "object" ? (row.agency as Record<string, unknown>) : {};

  const { data: propRow } = await admin
    .schema("nodo_inmo")
    .from("properties")
    .select("org_id")
    .eq("share_token", token)
    .maybeSingle();

  let theme_settings: unknown = row.theme_settings ?? null;
  let logoPath =
    typeof agencyIn.logo_path === "string" ? agencyIn.logo_path : null;

  if (propRow?.org_id) {
    const full = await admin
      .schema("nodo_inmo")
      .from("org_profiles")
      .select("legal_name, phone, email, logo_path, pdf_logo_path, theme_settings")
      .eq("org_id", propRow.org_id)
      .maybeSingle();

    const profile = full.error
      ? (
          await admin
            .schema("nodo_inmo")
            .from("org_profiles")
            .select("legal_name, phone, email, logo_path, pdf_logo_path")
            .eq("org_id", propRow.org_id)
            .maybeSingle()
        ).data
      : full.data;

    if (profile) {
      if (!agencyIn.legal_name) agencyIn.legal_name = profile.legal_name;
      if (!agencyIn.phone) agencyIn.phone = profile.phone;
      if (!agencyIn.email) agencyIn.email = profile.email;
      logoPath = profile.logo_path || profile.pdf_logo_path || logoPath;
      if (!full.error) theme_settings = (profile as { theme_settings?: unknown }).theme_settings ?? null;
    }
  }

  let logo_url: string | null = null;
  if (logoPath) {
    const { data: signedLogo } = await admin.storage.from("org-branding").createSignedUrl(logoPath, 3600);
    logo_url = signedLogo?.signedUrl ?? null;
  }

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
    theme_settings,
    agency: {
      legal_name: (agencyIn.legal_name as string | null) ?? null,
      phone: (agencyIn.phone as string | null) ?? null,
      email: (agencyIn.email as string | null) ?? null,
      logo_url,
    },
  };
}
