import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { syncInmoUserClaims } from "@/lib/registration/provision";

function planToTier(plan: string): "starter" | "pro" {
  return plan.toLowerCase().includes("pro") ? "pro" : "starter";
}

const INMO_CODES = new Set(["inmo", "clínica", "clinica", "salud"]);

export async function POST(request: Request) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const nodoCode = String(body.nodo_code ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const plan = String(body.plan ?? "").trim();
  const clientName = String(body.client_name ?? "").trim();

  if (!nodoCode || !userId || !plan) {
    return Response.json({ error: "nodo_code, user_id y plan son obligatorios." }, { status: 400 });
  }

  const admin = createNodoAdminClient(nodoCode);
  if (!admin) {
    return Response.json({ error: `El nodo "${nodoCode}" no está configurado.` }, { status: 400 });
  }

  const tier = planToTier(plan);
  const code = nodoCode.toLowerCase();

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData.user) {
    return Response.json({ error: userErr?.message ?? "Usuario no encontrado." }, { status: 400 });
  }

  const email = userData.user.email ?? "";

  if (INMO_CODES.has(code) && email) {
    const synced = await syncInmoUserClaims({
      nodoCode,
      userId,
      email,
      clientName: clientName || email,
      plan,
    });
    if (!synced.ok) {
      return Response.json({ error: synced.error }, { status: 400 });
    }
    return Response.json({ ok: true, org_id: synced.org_id });
  }

  const { data: memberships, error: memberErr } = await admin
    .schema("shared")
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);

  if (memberErr) {
    return Response.json({ error: memberErr.message }, { status: 400 });
  }

  const orgIds = (memberships ?? []).map((row) => row.org_id as string);
  if (orgIds.length > 0) {
    const { error: tierErr } = await admin
      .schema("shared")
      .from("organizations")
      .update({ tier })
      .in("id", orgIds);
    if (tierErr) {
      return Response.json({ error: tierErr.message }, { status: 400 });
    }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(userData.user.app_metadata ?? {}),
      plan: tier,
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
