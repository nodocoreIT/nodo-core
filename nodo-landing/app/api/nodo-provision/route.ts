import { provisionNodoAccess } from "@/lib/registration/provision";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

export async function POST(request: Request) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const nodoCode = String(body.nodo_code ?? "").trim();
  const clientName = String(body.client_name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "").trim();
  const plan = String(body.plan ?? "").trim();

  if (!nodoCode || !email || !password) {
    return Response.json(
      { error: "nodo_code, email y password son obligatorios." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const result = await provisionNodoAccess({
    nodoCode,
    clientName,
    email,
    password,
    plan,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "Error de provisionamiento." }, { status: 400 });
  }

  return Response.json({
    ok: true,
    existing: result.existing ?? false,
    user_id: result.user_id ?? null,
    org_id: result.org_id ?? null,
    cliente_id: result.cliente_id ?? null,
  });
}
