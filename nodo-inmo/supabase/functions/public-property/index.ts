import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return json({ error: "missing token" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin.rpc("get_public_property", {
    p_share_token: token,
  });

  if (error) {
    console.error("get_public_property:", error.message);
    return json({ error: "not found" }, 404);
  }

  if (!data) {
    return json({ error: "not found" }, 404);
  }

  const photoPaths = Array.isArray(data.photo_paths) ? data.photo_paths as string[] : [];
  const photo_urls: string[] = [];

  for (const path of photoPaths) {
    const { data: signed, error: signErr } = await admin.storage
      .from("property-photos")
      .createSignedUrl(path, 3600);
    if (!signErr && signed?.signedUrl) {
      photo_urls.push(signed.signedUrl);
    }
  }

  const agency =
    data.agency && typeof data.agency === "object"
      ? { ...(data.agency as Record<string, unknown>) }
      : {};

  const { data: propRow } = await admin
    .schema("nodo_inmo")
    .from("properties")
    .select("org_id")
    .eq("share_token", token)
    .maybeSingle();

  let theme_settings: unknown = null;
  if (propRow?.org_id) {
    const { data: profile } = await admin
      .schema("nodo_inmo")
      .from("org_profiles")
      .select("logo_path, pdf_logo_path, theme_settings, legal_name, phone, email")
      .eq("org_id", propRow.org_id)
      .maybeSingle();
    if (profile) {
      if (!agency.legal_name) agency.legal_name = profile.legal_name;
      if (!agency.phone) agency.phone = profile.phone;
      if (!agency.email) agency.email = profile.email;
      agency.logo_path = profile.logo_path ?? profile.pdf_logo_path ?? agency.logo_path;
      theme_settings = profile.theme_settings;
    }
  }

  const logoPath = typeof agency.logo_path === "string" ? agency.logo_path : null;
  let logo_url: string | null = null;
  if (logoPath) {
    const { data: signedLogo } = await admin.storage
      .from("org-branding")
      .createSignedUrl(logoPath, 3600);
    logo_url = signedLogo?.signedUrl ?? null;
  }

  return json({ ...data, photo_urls, theme_settings, agency: { ...agency, logo_url } }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
