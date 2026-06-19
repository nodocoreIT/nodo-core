import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AuthOk = { ok: true; userId: string; role: string | null; email: string | null };
type AuthFail = { ok: false; response: NextResponse };

function isPanelAdminRole(role: string | null | undefined): boolean {
  return role?.trim().toLowerCase() === "admin";
}

/** Panel API guard — same gate as panel RLS (nodo_core.is_team_member). */
export async function requirePanelTeamMember(): Promise<AuthOk | AuthFail> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const { data: isMember, error: memberErr } = await supabase.rpc("is_team_member");

  if (memberErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: memberErr.message }, { status: 403 }),
    };
  }

  if (!isMember) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `No tenés acceso al panel.${user.email ? ` Sesión: ${user.email}.` : ""}`,
        },
        { status: 403 },
      ),
    };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: profileErr.message }, { status: 403 }),
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: profile?.role ?? null,
    email: user.email ?? null,
  };
}

async function resolvePanelRole(userId: string, sessionRole: string | null): Promise<string | null> {
  if (isPanelAdminRole(sessionRole)) return sessionRole;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return profile?.role ?? sessionRole;
}

/** Stricter guard for team management (invite, purge, etc.). */
export async function requirePanelAdmin(): Promise<AuthOk | AuthFail> {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth;

  const role = await resolvePanelRole(auth.userId, auth.role);
  if (isPanelAdminRole(role)) {
    return { ...auth, role };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: `Solo administradores del panel Nodo. Tu rol actual es "${role ?? "sin rol"}".${
          auth.email ? ` Sesión: ${auth.email}.` : ""
        }`,
      },
      { status: 403 },
    ),
  };
}
