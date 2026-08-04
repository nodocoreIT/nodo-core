import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import { fetchFeedbackInbox } from "@/lib/panel/feedback-inbox";

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
