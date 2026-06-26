// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";

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

  // Upsert read cursor for this professional + org
  await supabase
    .from("chat_read_cursors")
    .upsert(
      { professional_id: me.id, org_id: user.org_id, read_at: now },
      { onConflict: "professional_id,org_id" },
    );

  return NextResponse.json({ readAt: now });
}
