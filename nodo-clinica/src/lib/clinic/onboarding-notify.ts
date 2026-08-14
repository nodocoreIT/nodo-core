import { NODO_LANDING_URL } from "@/lib/clinic/platform-config";

type OnboardingNotifyType = "paciente" | "medico";

/**
 * Best-effort ping to nodo-landing so the team gets an email + n8n webhook
 * alert when a paciente/medico finishes onboarding and the account needs
 * habilitación. Never throws — a failure here must not break account
 * creation, which has already succeeded by the time this is called.
 *
 * Skipped outside production unless NEXT_PUBLIC_NODO_LANDING_URL is set
 * explicitly: NODO_LANDING_URL falls back to the real prod domain, and we
 * don't want local/dev test registrations firing real emails and webhooks.
 */
export async function notifyOnboardingCompleted(input: {
  type: OnboardingNotifyType;
  nombre: string;
  email: string;
}): Promise<void> {
  const hasExplicitLandingUrl = Boolean(process.env.NEXT_PUBLIC_NODO_LANDING_URL);
  if (process.env.NODE_ENV !== "production" && !hasExplicitLandingUrl) {
    console.warn(
      `onboarding-notify: skipped (no NEXT_PUBLIC_NODO_LANDING_URL set outside production; would otherwise hit ${NODO_LANDING_URL})`,
    );
    return;
  }

  try {
    const response = await fetch(`${NODO_LANDING_URL}/api/internal/onboarding-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ ...input, sourceNode: "clinica" }),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      console.error("onboarding-notify: non-OK response", response.status, bodyText);
    }
  } catch (err) {
    console.error("onboarding-notify: failed to notify", err);
  }
}
