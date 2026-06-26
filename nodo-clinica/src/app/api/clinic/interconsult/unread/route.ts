import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (user.role === "patient" || !user.org_id) {
    return NextResponse.json({ count: 0, items: [] });
  }

  const { data: me } = await supabase
    .from("professionals")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ count: 0, items: [] });
  }

  // Get the last-read cursor for this professional
  const { data: cursor } = await supabase
    .from("chat_read_cursors")
    .select("read_at")
    .eq("professional_id", me.id)
    .eq("org_id", user.org_id)
    .maybeSingle();

  const lastReadAt = (cursor?.read_at as string | null) ?? null;

  let query = supabase
    .from("interconsult_messages")
    .select("id, from_professional_id, from_professional_name, to_professional_id, content, created_at")
    .eq("org_id", user.org_id)
    .neq("from_professional_id", me.id)
    .or(`to_professional_id.is.null,to_professional_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  if (lastReadAt) {
    query = query.gt("created_at", lastReadAt);
  }

  const { data: messages } = await query;

  const items = (messages ?? []).slice(0, 5).map((m) => ({
    id: m.id,
    fromDoctorId: m.from_professional_id,
    fromDoctorName: m.from_professional_name,
    toDoctorId: m.to_professional_id,
    content: m.content,
    createdAt: m.created_at,
  }));

  return NextResponse.json({
    count: (messages ?? []).length,
    items,
  });
}
