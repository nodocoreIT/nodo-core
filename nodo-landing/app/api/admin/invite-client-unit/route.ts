import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNodeMailLabelByCode } from "@/lib/nodes";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { isMailConfigured, sendClientNodoInviteEmail } from "@/lib/mail";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

const INVITE_TTL_HOURS = 72;

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();

  if (!clientUnitId) {
    return NextResponse.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("client_units")
    .select("id, unit_code, status, client_id, access_user")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Nodo del cliente no encontrado." }, { status: 404 });
  }

  const { data: client } = await admin
    .from("clients")
    .select("name, email")
    .eq("id", unit.client_id)
    .maybeSingle();

  const email = (client?.email ?? unit.access_user)?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "El cliente no tiene correo electrónico." }, { status: 400 });
  }

  const nodeLabel = getNodeMailLabelByCode(unit.unit_code);
  const displayName = client?.name?.trim() || email.split("@")[0] || "Cliente";

  await admin
    .from("client_units")
    .update({
      status: "pending_onboarding",
      progress: 0,
      access_user: email,
      access_password: null,
    })
    .eq("id", clientUnitId);

  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: tokenRow, error: tokenErr } = await admin
    .from("activation_tokens")
    .insert({
      client_unit_id: clientUnitId,
      expires_at: expiresAt,
    })
    .select("token")
    .single();

  if (tokenErr || !tokenRow?.token) {
    return NextResponse.json({ error: "No se pudo generar el enlace de activación." }, { status: 500 });
  }

  await syncNodeEmailAccessForClient(admin, unit.client_id);

  const origin = new URL(request.url).origin;
  const activationUrl = `${origin}/onboarding?token=${tokenRow.token}`;

  if (isMailConfigured()) {
    await sendClientNodoInviteEmail({
      nombre: displayName,
      email,
      nodeLabel,
      activationUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    email,
    mail_sent: isMailConfigured(),
    activation_url: isMailConfigured() ? undefined : activationUrl,
  });
}
