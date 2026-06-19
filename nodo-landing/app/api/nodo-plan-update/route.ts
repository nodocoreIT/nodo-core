import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

function planToTier(plan: string): "starter" | "pro" {
  return plan.toLowerCase().includes("pro") ? "pro" : "starter";
}

export async function POST(request: Request) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const nodoCode = String(body.nodo_code ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const plan = String(body.plan ?? "").trim();

  if (!nodoCode || !userId || !plan) {
    return Response.json({ error: "nodo_code, user_id y plan son obligatorios." }, { status: 400 });
  }

  const admin = createNodoAdminClient(nodoCode);
  if (!admin) {
    return Response.json({ error: `El nodo "${nodoCode}" no está configurado.` }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { plan: planToTier(plan) },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
