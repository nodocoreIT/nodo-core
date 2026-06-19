import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODES } from "@/lib/nodes";
import { purgeNodoOperationalData } from "@/lib/purge-nodo-data";

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
    return NextResponse.json({ error: "Solo administradores del panel Nodo." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();
  const confirm = String(body.confirm ?? "").trim().toUpperCase();

  if (!clientUnitId) {
    return NextResponse.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
  }

  if (confirm !== "BORRAR") {
    return NextResponse.json(
      { error: 'Escribí BORRAR en el campo de confirmación para continuar.' },
      { status: 400 },
    );
  }

  const password = String(body.password ?? "");
  if (!password) {
    return NextResponse.json(
      { error: "Ingresá tu contraseña del dashboard para confirmar." },
      { status: 400 },
    );
  }

  if (!user.email) {
    return NextResponse.json({ error: "No se pudo verificar tu cuenta." }, { status: 400 });
  }

  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (passwordError) {
    return NextResponse.json(
      { error: "Contraseña incorrecta. No se borraron datos." },
      { status: 401 },
    );
  }

  const landingAdmin = createAdminClient();
  const { data: unit, error: unitErr } = await landingAdmin
    .from("client_units")
    .select("id, unit_code, access_user, provision_user_id, provisioned_at")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Nodo contratado no encontrado." }, { status: 404 });
  }

  if (!unit.provisioned_at || !unit.provision_user_id) {
    return NextResponse.json(
      { error: "Este nodo aún no tiene acceso provisionado. No hay datos operativos para borrar." },
      { status: 400 },
    );
  }

  const nodeDef = NODES.find((node) => node.code === unit.unit_code);
  if (!nodeDef?.provisionable) {
    return NextResponse.json(
      { error: "Este módulo no tiene borrado de datos configurado." },
      { status: 400 },
    );
  }

  const nodoAdmin = createNodoAdminClient(unit.unit_code);
  if (!nodoAdmin) {
    return NextResponse.json(
      { error: `El nodo "${unit.unit_code}" no está configurado en el servidor.` },
      { status: 400 },
    );
  }

  try {
    const result = await purgeNodoOperationalData(
      nodoAdmin,
      unit.unit_code,
      unit.provision_user_id,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudieron borrar los datos." },
      { status: 500 },
    );
  }
}
