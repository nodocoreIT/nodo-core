import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncTiendaUserClaims } from "@/lib/registration/provision";

/**
 * POST /api/tienda/provision
 * Called by the nodo-tienda SPA auth callback on first login.
 * Idempotent — safe to call on every login.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const access_token = auth?.replace("Bearer ", "").trim();

  if (!access_token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: { user }, error: userErr } = await admin.auth.getUser(access_token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  const userId = user.id;
  const email = user.email ?? "";
  const clientName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    email.split("@")[0];

  const result = await syncTiendaUserClaims({
    userId,
    email,
    clientName,
    plan: (user.app_metadata?.plan as string | undefined) ?? "starter",
  });

  if (!result.ok) {
    console.error("[tienda/provision]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orgId: result.org_id });
}
