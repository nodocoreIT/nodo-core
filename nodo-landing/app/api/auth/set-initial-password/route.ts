import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNodeRegistrationConfig, unitCodeFromSlug, normalizeUnitCode } from "@/lib/registration/node-config";
import { updateNodoUserPassword } from "@/lib/registration/provision";
import { authAdminForUnitCode, resolveAuthUserForUnit, setAuthUserPassword } from "@/lib/registration/client-unit-auth";
import { ensureNodoAuthActive } from "@/lib/registration/nodo-access-suspend";
import { getNodoPublicAuthConfig } from "@/lib/supabase/nodo-auth-config";

async function findClientUnit(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  unitCode: string,
) {
  const { data: access } = await admin
    .from("node_email_access")
    .select("client_unit_id")
    .eq("email", email)
    .eq("unit_code", unitCode)
    .maybeSingle();

  if (access?.client_unit_id) {
    const { data: unit } = await admin
      .from("client_units")
      .select("*")
      .eq("id", access.client_unit_id)
      .maybeSingle();
    if (unit) return unit;
  }

  const { data: unitByAccessUser } = await admin
    .from("client_units")
    .select("*")
    .eq("unit_code", unitCode)
    .ilike("access_user", email)
    .maybeSingle();

  return unitByAccessUser;
}

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
  const unit = await findClientUnit(admin, email, unitCode);

  if (!unit) {
    return NextResponse.json({ error: "No encontramos tu acceso en este nodo." }, { status: 404 });
  }

  if (unit.status !== "activo" && unit.status !== "onboarding") {
    return NextResponse.json(
      { error: "Tu cuenta aún no está habilitada. Esperá la confirmación de NODO Core." },
      { status: 403 },
    );
  }

  const authAdmin = authAdminForUnitCode(unit.unit_code) ?? admin;
  const authUser = await resolveAuthUserForUnit(authAdmin, unit);
  const mustReset = authUser?.appMetadata?.must_set_password === true;

  if (unit.password_set_at && !mustReset) {
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

  if (authUser) {
    const updated = await setAuthUserPassword(authAdmin, authUser.userId, password, {
      mustSetPassword: false,
      currentAppMetadata: authUser.appMetadata,
    });
    if (!updated.ok) {
      return NextResponse.json({ error: updated.error }, { status: 400 });
    }
  } else {
    const { data: created, error: createErr } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: unit.plan ?? unit.unit_code.toLowerCase(), must_set_password: false },
    });
    if (createErr || !created.user) {
      return NextResponse.json({ error: createErr?.message ?? "No se pudo crear el usuario." }, { status: 400 });
    }
  }

  if (cfg?.provisionable && unit.provision_user_id) {
    await updateNodoUserPassword(unit.unit_code, unit.provision_user_id, password);
  }

  const authUserId = authUser?.userId ?? unit.provision_user_id;
  if (authUserId && cfg?.provisionable) {
    const reactivate = await ensureNodoAuthActive(unit.unit_code, authUserId);
    if (!reactivate.ok) {
      console.error("[set-initial-password] reactivate auth:", reactivate.error);
    }
  }

  await admin
    .from("client_units")
    .update({
      access_user: email,
      access_password: password,
      password_set_at: new Date().toISOString(),
    })
    .eq("id", unit.id);

  let session: { access_token: string; refresh_token: string } | undefined;
  const authCfg = getNodoPublicAuthConfig(unit.unit_code);
  if (authCfg) {
    const anonClient = createClient(authCfg.url, authCfg.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInData.session) {
      session = {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      };
    } else if (signInErr) {
      console.error("[set-initial-password] signIn failed:", signInErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    nodeSlug: cfg?.slug ?? nodeSlug,
    session,
    login_error: session ? undefined : "No se pudo iniciar sesión automáticamente. Probá ingresar con tu email y contraseña.",
  });
}
