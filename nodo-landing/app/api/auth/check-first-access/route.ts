import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unitCodeFromSlug, normalizeUnitCode } from "@/lib/registration/node-config";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const nodeSlug = String(body.nodeSlug ?? "").trim();
  const unitCode = normalizeUnitCode(body.unitCode ?? "") ?? unitCodeFromSlug(nodeSlug);

  if (!email || !unitCode) {
    return NextResponse.json({ needsPassword: false });
  }

  const admin = createAdminClient();
  const { data: access } = await admin
    .from("node_email_access")
    .select("client_unit_id")
    .eq("email", email)
    .eq("unit_code", unitCode)
    .maybeSingle();

  if (!access) {
    return NextResponse.json({ needsPassword: false });
  }

  const { data: unit } = await admin
    .from("client_units")
    .select("status, password_set_at, access_user")
    .eq("id", access.client_unit_id)
    .maybeSingle();

  const needsPassword =
    unit?.status === "activo" && !unit.password_set_at && !!unit.access_user;

  return NextResponse.json({ needsPassword });
}
