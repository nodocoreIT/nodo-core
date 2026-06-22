import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOnboardingPlanCatalog } from "@/lib/onboarding/plan-catalog";
import {
  getNodeRegistrationConfig,
  requiresIdentityVerification,
} from "@/lib/registration/node-config";
import { NODES, getNodeMailLabelByCode } from "@/lib/nodes";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token faltante." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("activation_tokens")
    .select("expires_at, used_at, client_unit_id")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "Enlace inválido." }, { status: 400 });
  }

  if (tokenRow.used_at) {
    return NextResponse.json({ error: "Este enlace ya fue utilizado." }, { status: 400 });
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "El enlace expiró." }, { status: 400 });
  }

  const { data: unit } = await admin
    .from("client_units")
    .select("status, unit_code, plan, clients(email, name)")
    .eq("id", tokenRow.client_unit_id)
    .single();

  if (!unit || unit.status !== "pending_onboarding") {
    return NextResponse.json({ error: "La solicitud no está disponible." }, { status: 400 });
  }

  const clientsRow = unit.clients as { email: string | null; name: string | null } | { email: string | null; name: string | null }[] | null;
  const client = Array.isArray(clientsRow) ? clientsRow[0] : clientsRow;
  const nameParts = (client?.name ?? "").trim().split(/\s+/);
  const nodeDef = NODES.find((node) => node.code === unit.unit_code);
  const registrationCfg = getNodeRegistrationConfig(unit.unit_code);
  const planCatalog = await loadOnboardingPlanCatalog(unit.unit_code);

  return NextResponse.json({
    ok: true,
    email: client?.email ?? "",
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" ") ?? "",
    unitCode: unit.unit_code,
    nodeSlug: registrationCfg?.slug ?? nodeDef?.slug ?? "",
    nodeCode: nodeDef?.code ?? unit.unit_code,
    nodeLabel: getNodeMailLabelByCode(unit.unit_code),
    plan: unit.plan,
    plans: planCatalog.plans,
    identityVerificationRequired: requiresIdentityVerification(unit.unit_code, unit.plan),
  });
}
