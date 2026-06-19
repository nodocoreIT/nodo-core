import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODES } from "@/lib/nodes";

function generateTemporaryPassword(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Nodo-${token}Aa1!`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Solo administradores." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();

  if (!clientUnitId) {
    return NextResponse.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
  }

  const landingAdmin = createAdminClient();
  const { data: unit, error: unitErr } = await landingAdmin
    .from("client_units")
    .select("id, unit_code, access_user, provision_user_id")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Nodo contratado no encontrado." }, { status: 404 });
  }

  if (!unit.access_user) {
    return NextResponse.json({ error: "El nodo no tiene email de acceso cargado." }, { status: 400 });
  }

  const nodeDef = NODES.find((node) => node.code === unit.unit_code);
  const authAdmin = nodeDef?.provisionable
    ? createNodoAdminClient(unit.unit_code)
    : createAdminClient("public");

  if (!authAdmin) {
    return NextResponse.json({ error: `El nodo "${unit.unit_code}" no está configurado.` }, { status: 400 });
  }

  let authUserId: string | null = unit.provision_user_id ?? null;
  let currentAppMetadata: Record<string, unknown> = {};

  if (authUserId) {
    const { data } = await authAdmin.auth.admin.getUserById(authUserId);
    currentAppMetadata = data.user?.app_metadata ?? {};
  } else {
    const { data } = await authAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = data.users.find((authUser) => {
      return authUser.email?.toLowerCase() === unit.access_user?.toLowerCase();
    });
    authUserId = matched?.id ?? null;
    currentAppMetadata = matched?.app_metadata ?? {};
  }

  if (!authUserId) {
    return NextResponse.json({ error: "No se encontró el usuario de acceso en Auth." }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: resetErr } = await authAdmin.auth.admin.updateUserById(authUserId, {
    password: temporaryPassword,
    app_metadata: {
      ...currentAppMetadata,
      must_set_password: true,
    },
  });

  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 400 });
  }

  await landingAdmin
    .from("client_units")
    .update({
      access_password: temporaryPassword,
      provision_user_id: authUserId,
    })
    .eq("id", clientUnitId);

  return NextResponse.json({
    ok: true,
    password: temporaryPassword,
    user_id: authUserId,
  });
}
