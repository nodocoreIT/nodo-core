import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { sendRecoveryEmail } from "@/lib/auth/send-recovery-email";

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();

  if (!clientUnitId) {
    return NextResponse.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
  }

  const landingAdmin = createAdminClient();
  const { data: unit, error: unitErr } = await landingAdmin
    .from("client_units")
    .select("id, unit_code, access_user")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Nodo contratado no encontrado." }, { status: 404 });
  }

  if (!unit.access_user) {
    return NextResponse.json({ error: "El nodo no tiene email de acceso cargado." }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const result = await sendRecoveryEmail({
    email: unit.access_user.trim(),
    nodeSlug: unit.unit_code,
    origin,
  });

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
