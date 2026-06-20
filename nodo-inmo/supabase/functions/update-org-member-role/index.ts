import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveInmoAdminOrgId } from "../_shared/inmo-admin.ts";
import { DISPLAY_TO_DB_ROLE } from "../_shared/org-member-roles.ts";

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

    const body = await req.json() as { userId?: string; role?: string };
    const userId = body.userId?.trim();
    const role = body.role?.trim();

    if (!userId || !role) {
      return json({ error: "userId and role are required" }, 400);
    }

    const dbRole = DISPLAY_TO_DB_ROLE[role] ?? "agent";

    const targetRows = await sql`
      SELECT role
      FROM shared.org_members
      WHERE org_id = ${orgId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
    `;

    if (targetRows.length === 0) {
      return json({ error: "Usuario no encontrado en el equipo." }, 404);
    }

    if (targetRows[0].role === "super_admin") {
      return json({ error: "No se puede modificar al dueño del nodo." }, 403);
    }

    if (targetRows[0].role === "admin") {
      return json({ error: "No se puede modificar un administrador." }, 403);
    }

    await sql`
      UPDATE shared.org_members
      SET role = ${dbRole}
      WHERE org_id = ${orgId}::uuid
        AND user_id = ${userId}::uuid
        AND role NOT IN ('admin', 'super_admin')
    `;

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
