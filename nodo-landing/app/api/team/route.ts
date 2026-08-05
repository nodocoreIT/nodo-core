import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelAdmin, requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

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

/**
 * Lists team members with their email — nodo_core.profiles has no email
 * column (it lives in auth.users, not exposed to the browser client), so
 * this joins them server-side via admin.auth.admin.listUsers(). No
 * pagination handling: the team is a handful of people, well under
 * listUsers()'s default page size.
 */
export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id, full_name, role, initials, color, created_at")
    .order("created_at");

  if (profilesErr) {
    console.error("[team] GET profiles", profilesErr);
    return Response.json({ error: "Error al cargar el equipo." }, { status: 500 });
  }

  const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers();
  if (usersErr) {
    console.error("[team] GET listUsers", usersErr);
    return Response.json({ error: "Error al cargar los emails del equipo." }, { status: 500 });
  }

  const emailById = new Map(usersPage.users.map((u) => [u.id, u.email ?? null]));

  const members = (profiles ?? []).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
  }));

  return Response.json({ members });
}

// Create a team member.
export async function POST(request: Request) {
  const auth = await requirePanelAdmin();
  if (!auth.ok) return auth.response;

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

/**
 * Edita nombre/rol de OTRO miembro del equipo. Tiene que pasar por acá (con
 * el admin client) porque la RLS de nodo_core.profiles ("own profile", USING
 * auth.uid() = id) solo deja a cada usuario editar su PROPIA fila — un
 * update del browser client sobre el id de otra persona corre sin error
 * pero filtra 0 filas, así que no pasaba nada silenciosamente.
 */
export async function PATCH(request: Request) {
  const auth = await requirePanelAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  const fullName = String(body.fullName ?? "").trim();
  const role = String(body.role ?? "").trim();

  if (!id || !fullName || !role) {
    return Response.json({ error: "id, fullName y role son obligatorios." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, initials: getInitials(fullName) })
    .eq("id", id);

  if (error) {
    console.error("[team] PATCH", error);
    return Response.json({ error: "Error al actualizar el miembro." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/**
 * Saca a alguien del equipo — borra su fila de nodo_core.profiles (revoca
 * acceso al panel vía is_team_member()), NO borra la cuenta de auth.users
 * completa. Borrar la cuenta entera es una operación más drástica, aparte,
 * hecha a mano con chequeo de FKs — ver conversación del team.
 */
export async function DELETE(request: Request) {
  const auth = await requirePanelAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "id es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").delete().eq("id", id);

  if (error) {
    console.error("[team] DELETE", error);
    return Response.json({ error: "Error al eliminar el miembro." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
