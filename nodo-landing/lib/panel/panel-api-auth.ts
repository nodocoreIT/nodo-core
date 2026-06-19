import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthOk = { ok: true; userId: string; role: string | null };
type AuthFail = { ok: false; response: NextResponse };

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
      response: NextResponse.json({ error: "No tenés acceso al panel." }, { status: 403 }),
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

  return { ok: true, userId: user.id, role: profile?.role ?? null };
}

/** Stricter guard for team management (invite, purge, etc.). */
export async function requirePanelAdmin(): Promise<AuthOk | AuthFail> {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth;

  if (auth.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Solo administradores." }, { status: 403 }),
    };
  }

  return auth;
}
