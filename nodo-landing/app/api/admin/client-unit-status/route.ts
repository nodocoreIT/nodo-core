import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NODES } from "@/lib/nodes";
import type { ClientUnitStatus } from "@/lib/registration/types";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

const ALLOWED: ClientUnitStatus[] = [
  "pending_review",
  "pending_onboarding",
  "onboarding",
  "activo",
  "pausado",
];

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
    .select("id, unit_code, status, provision_user_id")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return NextResponse.json({ error: "Unidad no encontrada." }, { status: 404 });
  }

  await admin.from("client_units").update({ status }).eq("id", clientUnitId);

  await admin
    .from("node_email_access")
    .update({ status })
    .eq("client_unit_id", clientUnitId);

  const nodeDef = NODES.find((n) => n.code === unit.unit_code);
  if (nodeDef?.provisionable && unit.provision_user_id) {
    const prev = unit.status;
    const needsSuspend = status === "pausado" && prev !== "pausado";
    const needsReactivate = status === "activo" && prev === "pausado";

    if (needsSuspend || needsReactivate) {
      const origin = request.nextUrl.origin;
      await fetch(`${origin}/api/nodo-suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          nodo_code: unit.unit_code,
          user_id: unit.provision_user_id,
          action: needsSuspend ? "suspend" : "reactivate",
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, status });
}
