import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveInmoAdminOrgId } from "../_shared/inmo-admin.ts";
import { DB_TO_DISPLAY_ROLE } from "./roles.ts";

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

    const orgId = await resolveInmoAdminOrgId(sql, user.id);
    if (!orgId) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const members = await sql`
      SELECT
        om.user_id::text AS id,
        om.role AS db_role,
        coalesce(up.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) AS name,
        u.email,
        (u.email_confirmed_at IS NOT NULL OR u.last_sign_in_at IS NOT NULL) AS is_active
      FROM shared.org_members om
      JOIN auth.users u ON u.id = om.user_id
      LEFT JOIN shared.user_profiles up ON up.id = om.user_id
      WHERE om.org_id = ${orgId}::uuid
        AND om.user_id <> ${user.id}::uuid
      ORDER BY om.created_at ASC
    `;

    return json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name ?? m.email,
        email: m.email,
        role: DB_TO_DISPLAY_ROLE[m.db_role] ?? m.db_role,
        dbRole: m.db_role,
        status: m.is_active ? "Activo" : "Pendiente",
      })),
    });
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
