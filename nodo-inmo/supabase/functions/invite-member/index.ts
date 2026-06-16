import { createClient } from "jsr:@supabase/supabase-js@2";
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth header" }, 401);
    }

    // Admin client — service role lives server-side only
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

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

    let orgId = user.app_metadata?.org_id as string | undefined;
    let callerRole = user.app_metadata?.role as string | undefined;

    // Fallback: JWT claim may be stale (issued before the custom token hook ran).
    // Check the database directly in that case.
    if (!callerRole || !orgId) {
      const { data: member } = await adminClient
        .schema("shared")
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (member) {
        orgId = orgId ?? (member.org_id as string);
        callerRole = callerRole ?? (member.role as string);
      }
    }

    if (callerRole !== "admin") {
      return json({ error: "Forbidden: admin role required" }, 403);
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

    // Send the invitation email
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo,
      });

    if (inviteError) {
      return json({ error: inviteError.message }, 400);
    }

    // Wire the new user into this org
    if (orgId) {
      const dbRole = DB_ROLES[memberRole] ?? "agent";
      const { error: memberError } = await adminClient
        .schema("shared")
        .from("org_members")
        .upsert(
          { org_id: orgId, user_id: inviteData.user.id, role: dbRole },
          { onConflict: "org_id,user_id" },
        );
      if (memberError) {
        console.error("org_members upsert error:", memberError.message);
      }
    }

    return json({ id: inviteData.user.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
