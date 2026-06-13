import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getColor(name: string): string {
  const colors = ["#2A6FDB", "#1F8A5B", "#DA5A0E", "#7C3AED", "#DB2777", "#0891B2"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Create a team member. Uses the admin API so the user is created already
// confirmed and the caller's own session is never touched (unlike client-side
// auth.signUp). Restricted to admins.
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
      { error: "Solo los administradores pueden crear miembros." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "").trim();
  const role = String(body.role ?? "dev");

  if (!fullName || !email || !password) {
    return Response.json(
      { error: "Nombre, email y contraseña son obligatorios." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return Response.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. Verificá el nombre en .env.local y REINICIÁ el servidor (next dev).",
      },
      { status: 500 }
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    return Response.json(
      { error: createErr?.message ?? "Error al crear el usuario." },
      { status: 400 }
    );
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role,
    initials: getInitials(fullName),
    color: getColor(fullName),
  });

  if (profileErr) {
    // Roll back the auth user so we don't leave an orphan without a profile.
    await admin.auth.admin.deleteUser(created.user.id);
    return Response.json(
      { error: "Error al crear el perfil: " + profileErr.message },
      { status: 400 }
    );
  }

  return Response.json({ ok: true, id: created.user.id });
}
