import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNodeRegistrationConfig } from "@/lib/registration/node-config";
import { getLoginHrefForNode, getNodeMailLabelByCode } from "@/lib/nodes";
import {
  provisionNodoAccessPendingPassword,
  createLandingAuthPendingPassword,
} from "@/lib/registration/provision";
import { sendAccountEnabledEmail, isMailConfigured } from "@/lib/mail";
import { setNodoAuthSuspendedForUnit } from "@/lib/registration/nodo-access-suspend";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (caller?.role !== "admin") {
    return Response.json({ error: "Solo administradores." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientUnitId = String(body.client_unit_id ?? "").trim();
  const adminNotes = String(body.admin_notes ?? "").trim();
  const docsVerified = Boolean(body.docs_verified);
  const action = String(body.action ?? "enable");

  if (!clientUnitId) {
    return Response.json({ error: "client_unit_id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: unit, error: unitErr } = await admin
    .from("client_units")
    .select("*")
    .eq("id", clientUnitId)
    .single();

  if (unitErr || !unit) {
    return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  const { data: client } = await admin
    .from("clients")
    .select("name, email")
    .eq("id", unit.client_id)
    .maybeSingle();

  const email = client?.email ?? unit.access_user;
  if (!email) {
    return Response.json({ error: "El cliente no tiene email registrado." }, { status: 400 });
  }

  if (action === "disable" && unit.status === "activo") {
    await admin
      .from("client_units")
      .update({ status: "pausado", admin_notes: adminNotes || unit.admin_notes })
      .eq("id", clientUnitId);
    await admin
      .from("node_email_access")
      .update({ status: "pausado" })
      .eq("client_unit_id", clientUnitId);
    return Response.json({ ok: true, status: "pausado" });
  }

  if (unit.status !== "pending_review") {
    return Response.json(
      { error: `Estado "${unit.status}" no permite habilitación.` },
      { status: 400 },
    );
  }

  const cfg = getNodeRegistrationConfig(unit.unit_code);
  const fullName = client?.name ?? email;
  const plan = unit.plan ?? "starter";

  let provisionUserId: string | null = unit.provision_user_id ?? null;

  if (cfg?.provisionable) {
    const result = await provisionNodoAccessPendingPassword({
      nodoCode: unit.unit_code,
      clientName: fullName,
      email,
      plan,
    });
    if (!result.ok) {
      return Response.json({ error: result.error ?? "Error de provisionamiento." }, { status: 400 });
    }
    provisionUserId = result.user_id ?? provisionUserId;
  } else {
    provisionUserId =
      (await createLandingAuthPendingPassword(
        admin,
        email,
        fullName,
        unit.plan ?? unit.unit_code.toLowerCase(),
      )) ?? provisionUserId;
  }

  const updatePayload: Record<string, string | number | null> = {
    status: "activo",
    progress: 100,
    enabled_at: new Date().toISOString(),
    admin_notes: adminNotes || unit.admin_notes,
    access_user: email,
    provisioned_at: provisionUserId ? new Date().toISOString() : unit.provisioned_at,
    provision_user_id: provisionUserId,
    access_url: cfg?.accessUrl ?? unit.access_url,
  };
  if (docsVerified) {
    updatePayload.docs_verified_at = new Date().toISOString();
  }

  await admin.from("client_units").update(updatePayload).eq("id", clientUnitId);
  await admin
    .from("node_email_access")
    .update({ status: "activo" })
    .eq("client_unit_id", clientUnitId);

  if (cfg?.provisionable && provisionUserId) {
    const reactivate = await setNodoAuthSuspendedForUnit(
      unit.unit_code,
      { provision_user_id: provisionUserId, access_user: email },
      "reactivate",
    );
    if (!reactivate.ok) {
      console.error("[enable-registration] reactivate auth:", reactivate.error);
    }
  }

  const origin = new URL(request.url).origin;
  const loginPath = getLoginHrefForNode(cfg?.slug ?? "inmo");
  const loginUrl = `${origin}${loginPath}?mode=first-access`;

  if (isMailConfigured()) {
    await sendAccountEnabledEmail({
      nombre: fullName,
      email,
      nodeLabel: getNodeMailLabelByCode(unit.unit_code),
      loginUrl,
    });
  }

  return Response.json({ ok: true, status: "activo" });
}
