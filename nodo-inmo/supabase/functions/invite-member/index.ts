import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";

// Display role → DB role (shared.org_members.role constraint)
const DB_ROLES: Record<string, string> = {
  Administrador: "admin",
  Vendedor: "agent",
  Inquilino: "tenant",
  Propietario: "owner",
  Colega: "agent",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Direct Postgres connection — bypasses REST schema exposure limits.
  // shared.org_members is not in the REST exposed schemas list.
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth header" }, 401);
    }

    // Verify the caller's JWT
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Read role + org from shared schema via direct Postgres (not REST)
    let orgId = user.app_metadata?.org_id as string | undefined;
    let callerRole = user.app_metadata?.role as string | undefined;

    if (!callerRole || !orgId) {
      // Filter by the nodo-inmo product so cross-product roles (e.g. 'medico'
      // from nodo-clinica on the same user account) don't bleed through.
      const rows = await sql`
        SELECT om.org_id::text, om.role
        FROM shared.org_members om
        JOIN shared.organizations o ON o.id = om.org_id
        WHERE om.user_id = ${user.id}::uuid
          AND o.product IN ('inmo', 'nodo-inmo')
        LIMIT 1
      `;
      if (rows.length > 0) {
        orgId = orgId ?? rows[0].org_id;
        callerRole = callerRole ?? rows[0].role;
      }
    }

    if (callerRole !== "admin") {
      return json({
        error: "Forbidden: admin role required",
        debug: {
          user_id: user.id,
          app_metadata_role: user.app_metadata?.role ?? null,
          app_metadata_org_id: user.app_metadata?.org_id ?? null,
          resolved_role: callerRole ?? null,
          resolved_org_id: orgId ?? null,
        },
      }, 403);
    }

    const body = await req.json() as {
      name: string;
      email: string;
      role: string;
      redirectTo: string;
    };

    const { name, email, role: memberRole, redirectTo } = body;

    if (!email || !redirectTo) {
      return json({ error: "email and redirectTo are required" }, 400);
    }

    // Admin client — service role lives server-side only
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Send the invitation email
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo,
      });

    if (inviteError) {
      return json({ error: inviteError.message }, 400);
    }

    // Wire the new user into this org via direct Postgres
    if (orgId) {
      const dbRole = DB_ROLES[memberRole] ?? "agent";
      await sql`
        INSERT INTO shared.org_members (org_id, user_id, role)
        VALUES (${orgId}::uuid, ${inviteData.user.id}::uuid, ${dbRole})
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `;
    }

    return json({ id: inviteData.user.id });
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
