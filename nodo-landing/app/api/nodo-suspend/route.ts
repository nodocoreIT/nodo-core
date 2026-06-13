import { createClient } from "@/lib/supabase/server";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

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
    return Response.json({ error: "Solo los administradores pueden suspender accesos." }, { status: 403 });
  }

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
