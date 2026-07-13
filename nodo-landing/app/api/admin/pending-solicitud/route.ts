import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: NextRequest) {
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

  const admin = createAdminClient();

  // Safety check — only allow deletion of pending_review units
  const { data: unit } = await admin
    .from("client_units")
    .select("id, status")
    .eq("id", clientUnitId)
    .maybeSingle();

  if (!unit) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  if (unit.status !== "pending_review") {
    return NextResponse.json(
      { error: `No se puede eliminar una solicitud en estado "${unit.status}".` },
      { status: 400 },
    );
  }

  // Delete related rows first, then the unit itself
  await admin.from("identity_verification_checks").delete().eq("client_unit_id", clientUnitId);
  await admin.from("onboarding_profiles").delete().eq("client_unit_id", clientUnitId);
  await admin.from("node_email_access").delete().eq("client_unit_id", clientUnitId);
  await admin.from("client_units").delete().eq("id", clientUnitId);

  return NextResponse.json({ ok: true });
}
