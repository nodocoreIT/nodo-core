import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

export async function POST(request: Request) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const nodoCode = String(body.nodo_code ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const action = String(body.action ?? "").trim(); // "suspend" | "reactivate"

  if (!nodoCode || !userId || !["suspend", "reactivate"].includes(action)) {
    return Response.json({ error: "nodo_code, user_id y action (suspend|reactivate) son obligatorios." }, { status: 400 });
  }

  const admin = createNodoAdminClient(nodoCode);
  if (!admin) {
    return Response.json({ error: `El nodo "${nodoCode}" no está configurado.` }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: action === "suspend" ? "876600h" : "none",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
