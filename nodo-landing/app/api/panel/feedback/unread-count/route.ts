import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Exact unread count = count(shared.feedback) − count(feedback_read_state).
 * Uses head:true/count:exact so zero rows are transferred (D4) — decoupled
 * from the lossy panel_notifications 10-record/7-day feed on purpose.
 */
export async function GET() {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  try {
    const admin = createAdminClient();
    const [totalRes, readRes] = await Promise.all([
      admin.schema("shared").from("feedback").select("id", { count: "exact", head: true }),
      admin.from("feedback_read_state").select("id", { count: "exact", head: true }),
    ]);

    if (totalRes.error) throw totalRes.error;
    if (readRes.error) throw readRes.error;

    const count = Math.max((totalRes.count ?? 0) - (readRes.count ?? 0), 0);
    return Response.json({ count });
  } catch (err) {
    console.error("[panel/feedback/unread-count] GET", err);
    return Response.json({ error: "Error al calcular el feedback sin leer." }, { status: 500 });
  }
}
