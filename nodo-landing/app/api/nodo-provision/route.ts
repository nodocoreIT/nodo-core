import { createClient } from "@/lib/supabase/server";
import { provisionNodoAccess } from "@/lib/registration/provision";

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
    return Response.json(
      { error: "Solo los administradores pueden provisionar accesos." },
      { status: 403 },
    );
  }

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
