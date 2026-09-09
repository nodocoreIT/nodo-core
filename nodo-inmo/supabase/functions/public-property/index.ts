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

  return json({ ...data, photo_urls }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
