import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth header" }, 401);
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json() as { org_id: string };
    const { org_id: targetOrgId } = body;

    if (!targetOrgId) {
      return json({ error: "org_id is required" }, 400);
    }

    // Validate that the calling user is actually a member of the target org.
    const memberRows = await sql`
      SELECT om.role, o.product
      FROM shared.org_members om
      JOIN shared.organizations o ON o.id = om.org_id
      WHERE om.user_id = ${user.id}::uuid
        AND om.org_id = ${targetOrgId}::uuid
      LIMIT 1
    `;

    if (memberRows.length === 0) {
      return json({ error: "Forbidden: you are not a member of this organization" }, 403);
    }

    const { role, product } = memberRows[0] as { role: string; product: string };

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        org_id: targetOrgId,
        role,
        plan: product,
      },
    });

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
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
