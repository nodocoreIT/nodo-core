import { resolvePublicLandingOrigin } from "./landing-url.ts";

type StaffNotifyPayload =
  | {
      kind: "invite";
      email: string;
      name: string;
      orgName: string;
      actionUrl: string;
      inviterName?: string;
      nodeLabel?: string;
    }
  | {
      kind: "added";
      email: string;
      name: string;
      orgName: string;
      loginUrl: string;
      inviterName?: string;
      nodeLabel?: string;
    };

export type StaffNotifyResult =
  | { sent: true }
  | { sent: false; reason: string };

export async function sendInmoStaffNotifyEmail(
  redirectTo: string,
  payload: StaffNotifyPayload,
): Promise<StaffNotifyResult> {
  const landingOrigin = resolvePublicLandingOrigin(redirectTo);
  if (!landingOrigin) {
    return {
      sent: false,
      reason:
        "Correo omitido: configurá NODO_LANDING_URL en Supabase o usá un dominio público (no localhost).",
    };
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    return { sent: false, reason: "Missing SUPABASE_SERVICE_ROLE_KEY" };
  }

  try {
    const response = await fetch(`${landingOrigin}/api/internal/inmo-staff-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        sent: false,
        reason: detail || "No se pudo enviar el correo de invitación",
      };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}
