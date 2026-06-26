import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveInmoAdminOrgId } from "../_shared/inmo-admin.ts";

interface PublishToMetaBody {
  network: "instagram" | "facebook";
  property_id: string;
  caption: string;
  org_id: string;
}

interface MetaSettings {
  instagram_account_id: string;
  facebook_page_id: string;
  access_token: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });

  try {
    // 1. Verify caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth header" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // 2. Parse body
    const body = await req.json() as PublishToMetaBody;
    const { network, property_id, caption, org_id } = body;

    if (!network || !property_id || !caption || !org_id) {
      return json({ error: "network, property_id, caption, and org_id are required" }, 400);
    }

    if (network !== "instagram" && network !== "facebook") {
      return json({ error: "network must be 'instagram' or 'facebook'" }, 400);
    }

    // 3. Validate caller is admin
    const resolvedOrgId = await resolveInmoAdminOrgId(sql, user.id);
    if (!resolvedOrgId || resolvedOrgId !== org_id) {
      return json({ error: "Forbidden: admin role required for this org" }, 403);
    }

    // Service-role client for privileged DB operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 4. Fetch property
    const { data: property, error: propertyError } = await serviceClient
      .schema("nodo_inmo")
      .from("properties")
      .select("id, main_photo, org_id")
      .eq("id", property_id)
      .eq("org_id", org_id)
      .single();

    if (propertyError || !property) {
      return json({ error: "Property not found" }, 404);
    }

    if (!property.main_photo) {
      return json({ error: "Property has no main photo" }, 422);
    }

    // 5. Fetch meta_settings from org_profiles
    const { data: orgProfile, error: orgError } = await serviceClient
      .schema("nodo_inmo")
      .from("org_profiles")
      .select("meta_settings")
      .eq("org_id", org_id)
      .single();

    if (orgError || !orgProfile?.meta_settings) {
      return json({ error: "Meta credentials not configured for this org" }, 422);
    }

    const metaSettings = orgProfile.meta_settings as unknown as MetaSettings;

    if (!metaSettings.access_token) {
      return json({ error: "Meta access_token not configured" }, 422);
    }

    // 6. Generate a 7-day signed URL for the main photo
    const { data: signedUrlData, error: signedUrlError } = await serviceClient
      .storage
      .from("property-photos")
      .createSignedUrl(property.main_photo, 604800); // 7 days

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return json({ error: "Failed to generate signed URL for photo" }, 500);
    }

    const imageUrl = signedUrlData.signedUrl;
    const accessToken = metaSettings.access_token;

    let postId: string;

    // 7. Publish to the selected network
    if (network === "instagram") {
      // Step 1: Create media container
      const accountId = metaSettings.instagram_account_id;
      if (!accountId) {
        return json({ error: "Instagram account ID not configured" }, 422);
      }

      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${accountId}/media?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl, caption }),
        },
      );

      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        return json({
          success: false,
          error: "Instagram media container creation failed",
          detail: containerData,
        }, 502);
      }

      const creationId = containerData.id as string;

      // Step 2: Publish media container
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${accountId}/media_publish?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: creationId }),
        },
      );

      const publishData = await publishRes.json();
      if (!publishRes.ok || !publishData.id) {
        return json({
          success: false,
          error: "Instagram media publish failed",
          detail: publishData,
        }, 502);
      }

      postId = publishData.id as string;
    } else {
      // Facebook: POST photo directly to the page
      const pageId = metaSettings.facebook_page_id;
      if (!pageId) {
        return json({ error: "Facebook page ID not configured" }, 422);
      }

      const fbRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/photos?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl, caption }),
        },
      );

      const fbData = await fbRes.json();
      if (!fbRes.ok || !fbData.post_id) {
        return json({
          success: false,
          error: "Facebook photo publish failed",
          detail: fbData,
        }, 502);
      }

      postId = fbData.post_id as string;
    }

    // 8. Save post_id back to the property
    const updateField = network === "instagram"
      ? { instagram_post_id: postId }
      : { facebook_post_id: postId };

    await serviceClient
      .schema("nodo_inmo")
      .from("properties")
      .update(updateField)
      .eq("id", property_id);

    // 9. Return success
    return json({ success: true, post_id: postId, network });
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  } finally {
    await sql.end();
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
