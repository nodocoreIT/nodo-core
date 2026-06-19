import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODES } from "@/lib/nodes";
import { purgeNodoOperationalData } from "@/lib/purge-nodo-data";
import { requirePanelAdmin } from "@/lib/panel/panel-api-auth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePanelAdmin();
    if (!auth.ok) return auth.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return jsonError("No se pudo verificar tu cuenta.", 401);
    }

    const body = await request.json().catch(() => ({}));
    const clientUnitId = String(body.client_unit_id ?? "").trim();
    const confirm = String(body.confirm ?? "").trim().toUpperCase();

    if (!clientUnitId) {
      return jsonError("client_unit_id es obligatorio.", 400);
    }

    if (confirm !== "BORRAR") {
      return jsonError("Escribí BORRAR en el campo de confirmación para continuar.", 400);
    }

    const password = String(body.password ?? "");
    if (!password) {
      return jsonError("Ingresá tu contraseña del dashboard para confirmar.", 400);
    }

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (passwordError) {
      return jsonError("Contraseña incorrecta. No se borraron datos.", 401);
    }

    const landingAdmin = createAdminClient();
    const { data: unit, error: unitErr } = await landingAdmin
      .from("client_units")
      .select("id, unit_code, access_user, provision_user_id, provisioned_at")
      .eq("id", clientUnitId)
      .single();

    if (unitErr || !unit) {
      return jsonError("Nodo contratado no encontrado.", 404);
    }

    if (!unit.provisioned_at || !unit.provision_user_id) {
      return jsonError(
        "Este nodo aún no tiene acceso provisionado. No hay datos operativos para borrar.",
        400,
      );
    }

    const nodeDef = NODES.find((node) => node.code === unit.unit_code);
    if (!nodeDef?.provisionable) {
      return jsonError("Este módulo no tiene borrado de datos configurado.", 400);
    }

    const nodoAdmin = createNodoAdminClient(unit.unit_code);
    if (!nodoAdmin) {
      return jsonError(`El nodo "${unit.unit_code}" no está configurado en el servidor.`, 400);
    }

    const result = await purgeNodoOperationalData(
      nodoAdmin,
      unit.unit_code,
      unit.provision_user_id,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[purge-nodo-data]", err);
    return jsonError(
      err instanceof Error ? err.message : "No se pudieron borrar los datos.",
      500,
    );
  }
}
