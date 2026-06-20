import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";
import { corsHeaders } from "../_shared/cors.ts";
import { upsertOrgMember } from "../_shared/inmo-admin.ts";

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

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = bearerToken === serviceKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      // Regular user JWT path: resolve from auth.
      const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: userError } = await callerClient.auth.getUser();
      if (userError || !user) {
        return json({ error: "Unauthorized" }, 401);
      }
      userId = user.id;
    }

    const body = await req.json() as {
      token: string;
      action?: "accept" | "reject";
      userId?: string; // supplied by service-role proxy (landing panel)
    };

    const { token, action = "accept" } = body;

    // When called via service role, accept userId from body.
    if (isServiceRole && body.userId) {
      userId = body.userId;
    }

    if (!token) {
      return json({ error: "token is required" }, 400);
    }

    // Fetch the invitation row.
    const rows = await sql`
      SELECT id, org_id::text, invitee_user_id::text, status, expires_at, role
      FROM shared.org_invitations
      WHERE token = ${token}::uuid
      LIMIT 1
    `;

    if (rows.length === 0) {
      return json({ error: "Invitation not found" }, 404);
    }

    const invitation = rows[0] as {
      id: string;
      org_id: string;
      invitee_user_id: string | null;
      status: string;
      expires_at: string;
      role: string;
    };

    // Auto-expire if past expiry date.
    if (invitation.status === "pending" && new Date(invitation.expires_at) < new Date()) {
      await sql`
        UPDATE shared.org_invitations
        SET status = 'expired'
        WHERE id = ${invitation.id}::uuid
      `;
      return json({ error: "Invitation has expired" }, 410);
    }

    if (invitation.status === "accepted") {
      return json({ error: "Invitation already accepted" }, 409);
    }

    if (invitation.status === "rejected") {
      return json({ error: "Invitation was rejected" }, 409);
    }

    if (invitation.status === "expired") {
      return json({ error: "Invitation has expired" }, 410);
    }

    if (invitation.status !== "pending") {
      return json({ error: "Invitation is not pending" }, 409);
    }

    // Link invitee_user_id if not set (e.g. for newly provisioned users who
    // clicked the magic link and now have an auth session).
    if (!invitation.invitee_user_id && userId) {
      await sql`
        UPDATE shared.org_invitations
        SET invitee_user_id = ${userId}::uuid
        WHERE id = ${invitation.id}::uuid
      `;
    }

    // Resolve the actual userId to use for org membership.
    const effectiveUserId = invitation.invitee_user_id ?? userId;
    if (!effectiveUserId) {
      return json({ error: "Cannot determine invitee user identity" }, 400);
    }

    if (action === "reject") {
      await sql`
        UPDATE shared.org_invitations
        SET status = 'rejected'
        WHERE id = ${invitation.id}::uuid
      `;
      return json({ ok: true, action: "rejected" });
    }

    // Accept: upsert org_members then mark invitation accepted.
    await upsertOrgMember(sql, invitation.org_id, effectiveUserId, invitation.role);

    await sql`
      UPDATE shared.org_invitations
      SET status = 'accepted', accepted_at = now()
      WHERE id = ${invitation.id}::uuid
    `;

    return json({ ok: true, org_id: invitation.org_id, role: invitation.role });
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
