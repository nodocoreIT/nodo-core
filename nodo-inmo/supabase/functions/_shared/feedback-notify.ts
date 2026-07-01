import { resolvePublicLandingOrigin } from "./landing-url.ts";

type FeedbackNotifyPayload = {
  category: "bug" | "idea" | "bloat";
  content: string;
  sourceNode: string;
  userEmail?: string;
};

export type FeedbackNotifyResult =
  | { sent: true }
  | { sent: false; reason: string };

export async function notifyFeedbackToLanding(
  redirectTo: string,
  payload: FeedbackNotifyPayload,
): Promise<FeedbackNotifyResult> {
  const landingOrigin = resolvePublicLandingOrigin(redirectTo);
  if (!landingOrigin) {
    return {
      sent: false,
      reason: "Omitido: configurá NODO_LANDING_URL en Supabase o usá un dominio público (no localhost).",
    };
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return { sent: false, reason: "Missing SUPABASE_SERVICE_ROLE_KEY" };
  }

  try {
    const response = await fetch(`${landingOrigin}/api/internal/feedback-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, reason: detail || "Error al notificar feedback" };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}
