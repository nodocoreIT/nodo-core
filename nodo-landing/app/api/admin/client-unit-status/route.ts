import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NODES } from "@/lib/nodes";
import type { ClientUnitStatus } from "@/lib/registration/types";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { setNodoAuthSuspendedForUnit } from "@/lib/registration/nodo-access-suspend";

const ALLOWED: ClientUnitStatus[] = ["activo", "pausado"];

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();
  const status = String(body.status ?? "").trim() as ClientUnitStatus;

  if (!clientUnitId || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "client_unit_id y status válido son obligatorios." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: unit, error: unitErr } = await admin
    .from("client_units")
    .select("id, unit_code, status, provision_user_id, access_user, client_id")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Unidad no encontrada." }, { status: 404 });
  }

  if (!ALLOWED.includes(unit.status as ClientUnitStatus)) {
    return NextResponse.json(
      { error: "Este estado solo lo puede cambiar el cliente al activar su cuenta." },
      { status: 400 },
    );
  }

  const prev = unit.status;
  const needsReactivate = status === "activo" && prev === "pausado";

  // Only lift existing auth bans when reactivating — do NOT ban when pausing.
  // All nodos share one Supabase project, so auth bans are global and would
  // affect every nodo. Per-nodo pause is handled by node_email_access.status
  // (checked in the user_has_node_access RPC at login time).
  const nodeDef = NODES.find((n) => n.code === unit.unit_code);
  if (nodeDef?.provisionable && needsReactivate) {
    const suspendResult = await setNodoAuthSuspendedForUnit(
      unit.unit_code,
      unit,
      "reactivate",
    );
    // Best-effort — don't block status change if unban fails
    if (suspendResult.ok && suspendResult.userId && !unit.provision_user_id) {
      await admin
        .from("client_units")
        .update({ provision_user_id: suspendResult.userId })
        .eq("id", clientUnitId);
    }
  }

  await admin.from("client_units").update({ status }).eq("id", clientUnitId);
  await syncNodeEmailAccessForClient(admin, unit.client_id);

  return NextResponse.json({ ok: true, status });
}
