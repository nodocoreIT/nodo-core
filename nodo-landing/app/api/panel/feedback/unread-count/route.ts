import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { fetchUnreadFeedbackCount } from "@/lib/panel/feedback-inbox";

/**
 * Exact unread count via real anti-join (countUnreadFeedback in
 * feedback-inbox.ts) — not a subtraction of counts, which can diverge if
 * feedback_read_state has an orphaned feedback_id. Decoupled from the lossy
 * panel_notifications 10-record/7-day feed on purpose.
 */
export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const count = await fetchUnreadFeedbackCount();
    return Response.json({ count });
  } catch (err) {
    console.error("[panel/feedback/unread-count] GET", err);
    return Response.json({ error: "Error al calcular el feedback sin leer." }, { status: 500 });
  }
}
