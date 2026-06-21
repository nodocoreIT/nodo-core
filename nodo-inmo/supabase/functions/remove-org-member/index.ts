import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveInmoAdminOrgId, resolveInmoCallerRole } from "../_shared/inmo-admin.ts";

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

    const body = await req.json() as { userId?: string };
    const userId = body.userId?.trim();
    if (!userId) {
      return json({ error: "userId is required" }, 400);
    }

    if (userId === user.id) {
      return json({ error: "No podés eliminarte a vos mismo del equipo." }, 400);
    }

    const callerRole = await resolveInmoCallerRole(sql, orgId, user.id);
    const callerIsSuperAdmin = callerRole === "super_admin";

    const targetRows = await sql`
      SELECT role
      FROM shared.org_members
      WHERE org_id = ${orgId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
    `;

    if (targetRows.length === 0) {
      // Not in org_members — check if there's a pending invitation instead.
      const pendingRows = await sql`
        DELETE FROM shared.org_invitations
        WHERE org_id = ${orgId}::uuid
          AND (invitee_user_id = ${userId}::uuid OR id = ${userId}::uuid)
          AND status = 'pending'
        RETURNING id
      `;

      if (pendingRows.length > 0) {
        return json({ ok: true });
      }

      return json({ error: "Usuario no encontrado en el equipo." }, 404);
    }

    if (targetRows[0].role === "super_admin") {
      return json({ error: "No se puede eliminar al dueño del nodo." }, 403);
    }

    if (targetRows[0].role === "admin" && !callerIsSuperAdmin) {
      return json({ error: "No se puede eliminar un administrador." }, 403);
    }

    if (callerIsSuperAdmin) {
      await sql`
        DELETE FROM shared.org_members
        WHERE org_id = ${orgId}::uuid
          AND user_id = ${userId}::uuid
      `;
    } else {
      await sql`
        DELETE FROM shared.org_members
        WHERE org_id = ${orgId}::uuid
          AND user_id = ${userId}::uuid
          AND role <> 'admin'
      `;
    }

    // Also clean up any lingering invitation records.
    await sql`
      DELETE FROM shared.org_invitations
      WHERE org_id = ${orgId}::uuid
        AND invitee_user_id = ${userId}::uuid
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
