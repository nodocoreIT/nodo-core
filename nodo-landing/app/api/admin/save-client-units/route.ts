import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { revokeClientUnitAccess } from "@/lib/registration/revoke-client-access";

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
  const units = Array.isArray(body.units) ? (body.units as UnitPayload[]) : [];

  if (!clientId) {
    return NextResponse.json({ error: "client_id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingUnits, error: fetchErr } = await admin
    .from("client_units")
    .select("id, unit_code, provision_user_id, access_user")
    .eq("client_id", clientId);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

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

  return NextResponse.json({ ok: true, units: data ?? [] });
}
