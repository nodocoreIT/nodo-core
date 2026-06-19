import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authAdminForUnitCode,
  ensureAuthUserForUnit,
  MIN_ACCESS_PASSWORD_LENGTH,
} from "@/lib/registration/client-unit-auth";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const clientId = String(body.client_id ?? "").trim();
  const unitCode = String(body.unit_code ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!clientId || !unitCode || !password) {
    return NextResponse.json(
      { error: "client_id, unit_code y password son obligatorios." },
      { status: 400 },
    );
  }

  if (password.length < MIN_ACCESS_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_ACCESS_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  const landingAdmin = createAdminClient();
  const { data: unit, error: unitErr } = await landingAdmin
    .from("client_units")
    .select("id, unit_code, access_user, provision_user_id, plan, clients(name)")
    .eq("client_id", clientId)
    .eq("unit_code", unitCode)
    .maybeSingle();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Nodo contratado no encontrado." }, { status: 404 });
  }

  if (!unit.access_user) {
    return NextResponse.json({ error: "El nodo no tiene email de acceso cargado." }, { status: 400 });
  }

  const authAdmin = authAdminForUnitCode(unit.unit_code);
  if (!authAdmin) {
    return NextResponse.json({ error: `El nodo "${unit.unit_code}" no está configurado.` }, { status: 400 });
  }

  const clientName =
    (unit.clients as { name?: string } | null)?.name ?? unit.access_user;

  const ensured = await ensureAuthUserForUnit(authAdmin, {
    unit,
    password,
    mustSetPassword: false,
    unitCode: unit.unit_code,
    clientName,
    plan: unit.plan ?? undefined,
  });

  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 400 });
  }

  await landingAdmin
    .from("client_units")
    .update({
      access_password: password,
      password_set_at: new Date().toISOString(),
      provision_user_id: ensured.userId,
      provisioned_at: new Date().toISOString(),
    })
    .eq("id", unit.id);

  return NextResponse.json({ ok: true, user_id: ensured.userId });
}
