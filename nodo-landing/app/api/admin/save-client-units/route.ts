import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { revokeClientUnitAccess } from "@/lib/registration/revoke-client-access";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { provisionNodoAccess } from "@/lib/registration/provision";
import { NODES } from "@/lib/nodes";

type UnitPayload = {
  unit_code: string;
  plan: string | null;
  status: string;
  progress: number;
  access_url: string | null;
  access_user: string | null;
  access_password: string | null;
  provisioned_at: string | null;
  provision_user_id: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. Verificá .env.local y reiniciá el servidor.",
      },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const clientId = String(body.client_id ?? "").trim();
  const clientName = String(body.client_name ?? "").trim();
  const runProvision = body.provision === true;
  const units = Array.isArray(body.units) ? (body.units as UnitPayload[]) : [];

  if (!clientId) {
    return NextResponse.json({ error: "client_id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingUnits, error: fetchErr } = await admin
    .from("client_units")
    .select("id, unit_code, provision_user_id, access_user, plan")
    .eq("client_id", clientId);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

  const hadExistingUnits = (existingUnits ?? []).length > 0;

  if (hadExistingUnits) {
    for (const prev of existingUnits ?? []) {
      const next = units.find((u) => String(u.unit_code ?? "").trim() === prev.unit_code);
      if (!next) {
        await revokeClientUnitAccess(prev);
        continue;
      }
      const nextEmail = String(next.access_user ?? "").trim().toLowerCase();
      const prevEmail = String(prev.access_user ?? "").trim().toLowerCase();
      if (
        prevEmail &&
        nextEmail &&
        prevEmail !== nextEmail &&
        (prev.provision_user_id || prev.access_user)
      ) {
        await revokeClientUnitAccess(prev);
      }
    }

    const { error: deleteErr } = await admin.from("client_units").delete().eq("client_id", clientId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }
  }

  if (units.length === 0) {
    return NextResponse.json({ ok: true, units: [] });
  }

  const rows = units.map((u) => ({
    client_id: clientId,
    unit_code: String(u.unit_code ?? "").trim(),
    plan: u.plan?.trim() || null,
    status: String(u.status ?? "activo").trim(),
    progress: Math.max(0, Math.min(100, Number(u.progress) || 0)),
    access_url: u.access_url?.trim() || null,
    access_user: u.access_user?.trim() || null,
    access_password: u.access_password?.trim() || null,
    provisioned_at: u.provisioned_at || null,
    provision_user_id: u.provision_user_id || null,
  }));

  const invalid = rows.find((r) => !r.unit_code);
  if (invalid) {
    return NextResponse.json({ error: "Cada nodo necesita un unit_code válido." }, { status: 400 });
  }

  const { data, error: insertErr } = await admin.from("client_units").insert(rows).select();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  await syncNodeEmailAccessForClient(admin, clientId);

  type ProvisionResultRow = {
    unit_code: string;
    ok: boolean;
    user_id?: string;
    error?: string;
    existing?: boolean;
  };

  const provisionResults: ProvisionResultRow[] = [];

  if (runProvision && clientName) {
    for (const unit of data ?? []) {
      const nodeDef = NODES.find((node) => node.code === unit.unit_code);
      const accessUser = String(unit.access_user ?? "").trim();
      const accessPassword = String(unit.access_password ?? "").trim();

      if (!nodeDef?.provisionable) continue;
      if (!accessUser || !accessPassword) continue;
      if (unit.status === "pausado") continue;
      if (unit.provision_user_id) continue;

      const result = await provisionNodoAccess({
        nodoCode: unit.unit_code,
        clientName,
        email: accessUser,
        password: accessPassword,
        plan: String(unit.plan ?? "").trim() || "starter",
      });

      if (result.ok && result.user_id) {
        await admin
          .from("client_units")
          .update({
            provisioned_at: new Date().toISOString(),
            provision_user_id: result.user_id,
          })
          .eq("id", unit.id);

        unit.provisioned_at = new Date().toISOString();
        unit.provision_user_id = result.user_id;
      }

      provisionResults.push({
        unit_code: unit.unit_code,
        ok: result.ok,
        user_id: result.user_id,
        error: result.error,
        existing: result.existing,
      });
    }
  }

  return NextResponse.json({ ok: true, units: data ?? [], provision: provisionResults });
}
