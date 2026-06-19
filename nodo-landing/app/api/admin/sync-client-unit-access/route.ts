import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const clientId = String(body.client_id ?? "").trim();

  if (!clientId) {
    return NextResponse.json({ error: "client_id es obligatorio." }, { status: 400 });
  }

  const landingAdmin = createAdminClient();
  await syncNodeEmailAccessForClient(landingAdmin, clientId);

  return NextResponse.json({ ok: true });
}
