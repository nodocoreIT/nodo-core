// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";

const ONLINE_THRESHOLD_MS = 90_000;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient" || !user.org_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const now = Date.now();

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, full_name, specialty")
    .eq("org_id", user.org_id)
    .neq("id", me.id);

  const { data: presenceRows } = await supabase
    .from("doctor_presence")
    .select("professional_id, last_seen")
    .eq("org_id", user.org_id);

  const presenceMap = new Map(
    (presenceRows ?? []).map((p) => [
      p.professional_id,
      p.last_seen as string | null,
    ]),
  );

  const doctors = (professionals ?? [])
    .map((p) => {
      const lastSeen = presenceMap.get(p.id) ?? null;
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      return {
        id: p.id,
        fullName: p.full_name,
        specialty: p.specialty ?? null,
        online: now - lastSeenMs < ONLINE_THRESHOLD_MS,
        lastSeen,
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online));

  return NextResponse.json({ doctors });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient" || !user.org_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const now = new Date().toISOString();

  await supabase
    .from("doctor_presence")
    .upsert(
      { professional_id: me.id, org_id: user.org_id, last_seen: now },
      { onConflict: "professional_id,org_id" },
    );

  return NextResponse.json({ ok: true });
}
