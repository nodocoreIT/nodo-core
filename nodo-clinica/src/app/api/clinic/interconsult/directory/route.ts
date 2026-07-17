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
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const now = Date.now();

  // Query all professionals in this org (excluding self)
  const { data: professionals, error } = await supabase
    .from("professionals")
    .select("id, full_name, specialty, org_id")
    .eq("org_id", user.org_id)
    .neq("id", me.id);

  if (error) {
    return NextResponse.json({ error: "Error al obtener directorio" }, { status: 500 });
  }

  // Fetch presence data for this org
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

  type NodoChatContact = {
    id: string;
    fullName: string;
    role: string;
    nodeSlug: "salud";
    nodeLabel: string;
    plan: "pro";
    specialty?: string;
    online: boolean;
    lastSeen: string | null;
  };

  let contacts: NodoChatContact[] = (professionals ?? []).map((p) => {
    const lastSeenStr = presenceMap.get(p.id) ?? null;
    const lastSeenMs = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;
    return {
      id: p.id,
      fullName: p.full_name,
      role: "Médico",
      nodeSlug: "salud" as const,
      nodeLabel: "Nodo Salud",
      plan: "pro" as const,
      specialty: p.specialty ?? undefined,
      online: now - lastSeenMs < ONLINE_THRESHOLD_MS,
      lastSeen: lastSeenStr,
    };
  });

  if (q) {
    contacts = contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.nodeLabel.toLowerCase().includes(q) ||
        (c.specialty?.toLowerCase().includes(q) ?? false),
    );
  }

  contacts.sort((a, b) => Number(b.online) - Number(a.online));

  return NextResponse.json({ contacts, currentPlan: "profesional" });
}
