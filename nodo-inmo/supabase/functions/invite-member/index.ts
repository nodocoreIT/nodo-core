import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createOrgInvitation,
  findAuthUserIdByEmail,
  getOrgName,
  resolveAdminOrgId,
} from "../_shared/inmo-admin.ts";
import { sendInmoStaffNotifyEmail } from "../_shared/staff-notify.ts";
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

    const body = await req.json() as {
      name: string;
      email: string;
      role: string;
      redirectTo: string;
      inviterName?: string;
      nodeLabel?: string;
      products?: string[];
    };

    const products = body.products ?? ["inmo", "nodo-inmo"];
    const orgId = await resolveAdminOrgId(sql, user.id, products);
    if (!orgId) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    const { name, email, role: memberRole, redirectTo, nodeLabel } = body;

    if (!email || !redirectTo) {
      return json({ error: "email and redirectTo are required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const displayName = name?.trim() || normalizedEmail.split("@")[0];
    const dbRole = DISPLAY_TO_DB_ROLE[memberRole] ?? "agent";
    const orgName = await getOrgName(sql, orgId);
    // Use the caller-provided redirectTo directly — it already points to the correct nodo callback
    const authCallbackUrl = redirectTo;

    // Inviter display name: from request body, or fall back to JWT metadata.
    const inviterName =
      body.inviterName?.trim() ||
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      user.email ||
      "Un administrador";

    // Build invite params to embed in the login URL so the landing page can
    // show personalized copy ("Activá tu acceso como Vendedor — te invitó Ramiro").
    const inviteParams = new URLSearchParams({
      mode: "activate-invite",
      inviter: inviterName,
      role: memberRole,
    }).toString();

    // Login URL with invite context — used as redirectTo so Supabase appends tokens as hash
    const loginUrlWithParams = `${authCallbackUrl}?${inviteParams}`;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existingUserId = await findAuthUserIdByEmail(sql, normalizedEmail);
    if (existingUserId) {
      // Existing user: create invitation record (membership happens on acceptance).
      const token = await createOrgInvitation(sql, {
        orgId,
        inviteeEmail: normalizedEmail,
        inviteeUserId: existingUserId,
        invitedByUserId: user.id,
        role: dbRole,
        expiresAt,
      });

      // Set must_set_password flag and store display name so the members table shows it correctly
      await adminClient.auth.admin.updateUserById(existingUserId, {
        app_metadata: { must_set_password: true },
        user_metadata: { full_name: displayName },
      });

      // Generate a magic link so the user gets hash tokens on click —
      // they may not have a password yet.
      const { data: magicData } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: { redirectTo: loginUrlWithParams },
      });
      const actionUrl = magicData?.properties?.action_link ?? loginUrlWithParams;

      const mail = await sendInmoStaffNotifyEmail(redirectTo, {
        kind: "invite",
        email: normalizedEmail,
        name: displayName,
        orgName,
        actionUrl,
        inviterName,
        nodeLabel: nodeLabel ?? "NODO | Inmo",
      });

      return json({
        id: existingUserId,
        invited: false,
        invitationToken: token,
        emailSent: mail.sent,
        emailWarning: mail.sent ? undefined : mail.reason,
      });
    }

    // New user: generate magic link instead of sending Supabase-branded invite.
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: { full_name: displayName },
          redirectTo: loginUrlWithParams,
        },
      });

    if (linkError || !linkData?.user?.id) {
      return json(
        { error: linkError?.message ?? "No se pudo generar el enlace de invitación" },
        400,
      );
    }

    const userId = linkData.user.id;
    // Params are already embedded in loginUrlWithParams (the redirectTo) — Supabase appends tokens as hash
    const actionUrl = linkData.properties?.action_link ?? loginUrlWithParams;

    // Set must_set_password flag so user must complete password setup
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        must_set_password: true,
      },
    });

    // Create invitation record for the new user (invitee_user_id is already set
    // because generateLink provisions the auth.users row immediately).
    const token = await createOrgInvitation(sql, {
      orgId,
      inviteeEmail: normalizedEmail,
      inviteeUserId: userId,
      invitedByUserId: user.id,
      role: dbRole,
      expiresAt,
    });

    const mail = await sendInmoStaffNotifyEmail(redirectTo, {
      kind: "invite",
      email: normalizedEmail,
      name: displayName,
      orgName,
      actionUrl,
      inviterName,
      nodeLabel: nodeLabel ?? "NODO | Inmo",
    });

    return json({
      id: userId,
      invited: true,
      invitationToken: token,
      emailSent: mail.sent,
      emailWarning: mail.sent ? undefined : mail.reason,
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
