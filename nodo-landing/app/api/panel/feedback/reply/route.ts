import { NextRequest } from "next/server";
import { requirePanelTeamMember } from "@/lib/panel/panel-api-auth";
import {
  normalizeFeedbackStatus,
  replyToFeedback,
  type FeedbackReplyStatus,
} from "@/lib/panel/feedback-inbox";

/**
 * POST — reply to a feedback item from the panel (writes into
 * shared.feedback.metadata.replies + status, marks as read).
 */
export async function POST(request: NextRequest) {
  const auth = await requirePanelTeamMember();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const feedbackId = String(body.feedback_id ?? "").trim();
  const replyBody = String(body.body ?? "").trim();
  const status = normalizeFeedbackStatus(
    typeof body.status === "string" ? body.status : "respondido",
  ) as FeedbackReplyStatus;

  if (!feedbackId) {
    return Response.json({ error: "feedback_id es obligatorio." }, { status: 400 });
  }
  if (!replyBody) {
    return Response.json({ error: "Escribí una respuesta." }, { status: 400 });
  }

  try {
    const reply = await replyToFeedback({
      feedbackId,
      body: replyBody,
      status: status === "pendiente" ? "respondido" : status,
      readBy: auth.userId ?? null,
    });
    return Response.json({ ok: true, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return Response.json({ error: "Feedback no encontrado." }, { status: 404 });
    }
    console.error("[panel/feedback/reply] POST", err);
    return Response.json({ error: "Error al guardar la respuesta." }, { status: 500 });
  }
}
