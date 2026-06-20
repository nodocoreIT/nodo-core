import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

// Server-side route — fetches pending invitations for the calling user.
// Uses the inmo service role client to bypass RLS, then filters by the
// landing user's email (cross-project: the user has no inmo session).

export async function GET(_request: NextRequest) {
  // Authenticate via the landing session (same pattern as accept-invitation).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = user.email;
  if (!email) {
    return NextResponse.json({ invitations: [] });
  }

  // Service-role client for the inmo Supabase project — bypasses RLS.
  const admin = createNodoAdminClient("Inmo");
  if (!admin) {
    return NextResponse.json(
      { error: "Inmo not configured" },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();

  // Query with foreign-table joins to resolve org name and inviter display name.
  // Using schema-qualified table access via the admin client.
  const { data, error } = await admin
    .schema("shared")
    .from("org_invitations")
    .select(
      `
      id,
      token,
      role,
      status,
      expires_at,
      created_at,
      org:org_id ( name ),
      inviter:invited_by_user_id ( raw_user_meta_data )
    `,
    )
    .eq("invitee_email", email)
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("my-invitations:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invitations = (data ?? []).map((inv: any) => ({
    id: inv.id,
    token: inv.token,
    role: inv.role,
    expires_at: inv.expires_at,
    created_at: inv.created_at,
    org_name:
      (inv.org as { name?: string } | null)?.name ?? "—",
    inviter_name:
      (inv.inviter as { raw_user_meta_data?: Record<string, string> } | null)
        ?.raw_user_meta_data?.full_name ??
      (inv.inviter as { raw_user_meta_data?: Record<string, string> } | null)
        ?.raw_user_meta_data?.email ??
      "—",
  }));

  return NextResponse.json({ invitations });
}
