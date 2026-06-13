import { createClient } from "@/lib/supabase/server";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

function planToTier(plan: string): "starter" | "pro" {
  return plan.toLowerCase().includes("pro") ? "pro" : "starter";
}

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
      { status: 403 }
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
      { status: 400 }
    );
  }

  if (!process.env.NODO_INMO_SUPABASE_URL || !process.env.NODO_INMO_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: "Faltan NODO_INMO_SUPABASE_URL / NODO_INMO_SERVICE_ROLE_KEY en el entorno." },
      { status: 500 }
    );
  }

  const admin = createNodoAdminClient(nodoCode);
  if (!admin) {
    return Response.json(
      { error: `El nodo "${nodoCode}" no está configurado para provisionamiento.` },
      { status: 400 }
    );
  }

  // 1. Create auth user in the target nodo's Supabase
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: clientName || email },
    app_metadata: { plan: planToTier(plan) },
  });

  if (createErr) {
    const msg = createErr.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      // User exists — look them up to recover the user_id so callers can store it
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list?.users?.find((u) => u.email === email);
      return Response.json({ ok: true, existing: true, user_id: found?.id ?? null });
    }
    return Response.json({ error: msg }, { status: 400 });
  }

  const userId = created.user!.id;

  // 2. Create organization (tenant anchor)
  const { data: org, error: orgErr } = await admin
    .schema("shared")
    .from("organizations")
    .insert({ name: clientName || email, tier: planToTier(plan), product: "inmo" })
    .select("id")
    .single();

  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId);
    return Response.json(
      { error: "Error al crear la organización: " + (orgErr?.message ?? "") },
      { status: 400 }
    );
  }

  // 3. User profile
  await admin
    .schema("shared")
    .from("user_profiles")
    .insert({ id: userId, full_name: clientName || email });

  // 4. Org membership — triggers sync_member_claims Edge Function which sets
  //    app_metadata.org_id + app_metadata.role on the auth user's JWT
  const { error: memberErr } = await admin
    .schema("shared")
    .from("org_members")
    .insert({ org_id: org.id, user_id: userId, role: "admin" });

  if (memberErr) {
    await admin.schema("shared").from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return Response.json(
      { error: "Error al crear la membresía: " + memberErr.message },
      { status: 400 }
    );
  }

  return Response.json({ ok: true, user_id: userId, org_id: org.id });
}
