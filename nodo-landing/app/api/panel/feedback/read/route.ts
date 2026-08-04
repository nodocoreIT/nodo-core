import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";

/** Marks a shared.feedback row as read — idempotent via upsert on feedback_id. */
export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const feedbackId = String(body.feedback_id ?? "").trim();

  if (!feedbackId) {
    return NextResponse.json({ error: "feedback_id es obligatorio." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("feedback_read_state").upsert(
      {
        feedback_id: feedbackId,
        read_by: auth.userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "feedback_id" },
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[panel/feedback/read] POST", err);
    return NextResponse.json({ error: "Error al marcar como leído." }, { status: 500 });
  }
}

/** Unmarks a shared.feedback row (back to unread) by deleting its read-state row. */
export async function DELETE(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const feedbackId = String(body.feedback_id ?? "").trim();

  if (!feedbackId) {
    return NextResponse.json({ error: "feedback_id es obligatorio." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("feedback_read_state").delete().eq("feedback_id", feedbackId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[panel/feedback/read] DELETE", err);
    return NextResponse.json({ error: "Error al marcar como no leído." }, { status: 500 });
  }
}
