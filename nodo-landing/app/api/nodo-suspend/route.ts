import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import {
  setNodoAuthSuspended,
  type NodoSuspendAction,
} from "@/lib/registration/nodo-access-suspend";

export async function POST(request: Request) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const nodoCode = String(body.nodo_code ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const action = String(body.action ?? "").trim() as NodoSuspendAction;

  if (!nodoCode || !userId || !["suspend", "reactivate"].includes(action)) {
    return Response.json({ error: "nodo_code, user_id y action (suspend|reactivate) son obligatorios." }, { status: 400 });
  }

  const result = await setNodoAuthSuspended(nodoCode, userId, action);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}
