import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { notification_id, kind, title, description, href } = body as Record<string, string>;

  if (!notification_id || !kind || !title || !description || !href) {
    return NextResponse.json(
      { error: "notification_id, kind, title, description y href son obligatorios." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dismissed_panel_notifications").upsert(
    {
      notification_id,
      kind,
      title,
      description,
      href,
      deleted: false,
    },
    { onConflict: "notification_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const notification_id = String(body.notification_id ?? "").trim();

  if (!notification_id) {
    return NextResponse.json({ error: "notification_id es obligatorio." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dismissed_panel_notifications")
    .update({ deleted: true })
    .eq("notification_id", notification_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
