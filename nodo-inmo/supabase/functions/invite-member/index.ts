import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  findAuthUserIdByEmail,
  getOrgName,
  isOrgMember,
  resolveInmoAdminOrgId,
  upsertOrgMember,
} from "../_shared/inmo-admin.ts";
import { sendInmoStaffNotifyEmail } from "../_shared/staff-notify.ts";

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

    const normalizedEmail = email.trim().toLowerCase();
    const displayName = name?.trim() || normalizedEmail.split("@")[0];
    const dbRole = DB_ROLES[memberRole] ?? "agent";
    const orgName = await getOrgName(sql, orgId);
    const landingOrigin = new URL(redirectTo).origin;
    const loginUrl = `${landingOrigin}/inmo/login`;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const existingUserId = await findAuthUserIdByEmail(sql, normalizedEmail);
    if (existingUserId) {
      if (await isOrgMember(sql, orgId, existingUserId)) {
        return json(
          { error: "Este usuario ya pertenece a este nodo Inmo." },
          409,
        );
      }

      await upsertOrgMember(sql, orgId, existingUserId, dbRole);
      await sendInmoStaffNotifyEmail(redirectTo, {
        kind: "added",
        email: normalizedEmail,
        name: displayName,
        orgName,
        loginUrl,
      });

      return json({ id: existingUserId, invited: false, emailSent: true });
    }

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: { full_name: displayName },
          redirectTo,
        },
      });

    if (linkError || !linkData?.user?.id || !linkData.properties?.action_link) {
      return json(
        { error: linkError?.message ?? "No se pudo generar el enlace de invitación" },
        400,
      );
    }

    await upsertOrgMember(sql, orgId, linkData.user.id, dbRole);
    await sendInmoStaffNotifyEmail(redirectTo, {
      kind: "invite",
      email: normalizedEmail,
      name: displayName,
      orgName,
      actionUrl: linkData.properties.action_link,
    });

    return json({ id: linkData.user.id, invited: true, emailSent: true });
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
