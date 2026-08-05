import { NextRequest } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { deleteFeedback, fetchFeedbackInbox } from "@/lib/panel/feedback-inbox";

export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const feedback = await fetchFeedbackInbox();
    return Response.json({ feedback });
  } catch (err) {
    console.error("[panel/feedback] GET", err);
    return Response.json({ error: "Error al cargar el feedback." }, { status: 500 });
  }
}

/** Borra un feedback (irreversible) — solo desde el panel, con confirmación en la UI. */
export async function DELETE(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ error: "id es obligatorio." }, { status: 400 });
  }

  try {
    await deleteFeedback(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[panel/feedback] DELETE", err);
    return Response.json({ error: "Error al borrar el feedback." }, { status: 500 });
  }
}
