import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNodeRegistrationConfig, unitCodeFromSlug, normalizeUnitCode } from "@/lib/registration/node-config";
import { updateNodoUserPassword } from "@/lib/registration/provision";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  const nodeSlug = String(body.nodeSlug ?? "").trim();
  const unitCode = normalizeUnitCode(body.unitCode ?? "") ?? unitCodeFromSlug(nodeSlug);

  if (!email || !password || !unitCode) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: access } = await admin
    .from("node_email_access")
    .select("client_unit_id, client_id")
    .eq("email", email)
    .eq("unit_code", unitCode)
    .maybeSingle();

  if (!access) {
    return NextResponse.json({ error: "No encontramos tu solicitud en este nodo." }, { status: 404 });
  }

  const { data: unit } = await admin
    .from("client_units")
    .select("*")
    .eq("id", access.client_unit_id)
    .single();

  if (!unit || unit.status !== "activo") {
    return NextResponse.json(
      { error: "Tu cuenta aún no está habilitada. Esperá la confirmación de NODO Core." },
      { status: 403 },
    );
  }

  if (unit.password_set_at) {
    return NextResponse.json(
      { error: "Ya configuraste tu contraseña. Usá el login normal." },
      { status: 400 },
    );
  }

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", unit.client_id)
    .maybeSingle();

  const fullName = client?.name ?? email;
  const cfg = getNodeRegistrationConfig(unit.unit_code);

  // Landing auth (login hub)
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === email);

  if (authUser) {
    await admin.auth.admin.updateUserById(authUser.id, {
      password,
      app_metadata: { ...authUser.app_metadata, must_set_password: false },
    });
  } else {
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: unit.plan ?? unit.unit_code.toLowerCase(), must_set_password: false },
    });
  }

  if (cfg?.provisionable && unit.provision_user_id) {
    await updateNodoUserPassword(unit.unit_code, unit.provision_user_id, password);
  }

  await admin
    .from("client_units")
    .update({
      access_user: email,
      access_password: password,
      password_set_at: new Date().toISOString(),
    })
    .eq("id", unit.id);

  return NextResponse.json({ ok: true, nodeSlug: cfg?.slug ?? nodeSlug });
}
