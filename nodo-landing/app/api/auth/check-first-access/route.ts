import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unitCodeFromSlug, normalizeUnitCode } from "@/lib/registration/node-config";
import { authAdminForUnitCode, resolveAuthUserForUnit } from "@/lib/registration/client-unit-auth";

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

  let unit = null as {
    status: string;
    password_set_at: string | null;
    access_user: string | null;
    unit_code: string;
    provision_user_id: string | null;
  } | null;

  if (access?.client_unit_id) {
    const { data } = await admin
      .from("client_units")
      .select("status, password_set_at, access_user, unit_code, provision_user_id")
      .eq("id", access.client_unit_id)
      .maybeSingle();
    unit = data;
  }

  if (!unit) {
    const { data } = await admin
      .from("client_units")
      .select("status, password_set_at, access_user, unit_code, provision_user_id")
      .eq("unit_code", unitCode)
      .ilike("access_user", email)
      .maybeSingle();
    unit = data;
  }

  if (!unit) {
    return NextResponse.json({ needsPassword: false });
  }

  const authAdmin = authAdminForUnitCode(unit.unit_code) ?? admin;
  const authUser = await resolveAuthUserForUnit(authAdmin, unit);
  const mustReset = authUser?.appMetadata?.must_set_password === true;

  const needsPassword =
    (unit.status === "activo" || unit.status === "onboarding") &&
    !!unit.access_user &&
    (!unit.password_set_at || mustReset);

  return NextResponse.json({ needsPassword, mustResetPassword: mustReset });
}
