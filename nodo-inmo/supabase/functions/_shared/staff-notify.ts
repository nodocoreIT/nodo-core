type StaffNotifyPayload =
  | {
      kind: "invite";
      email: string;
      name: string;
      orgName: string;
      actionUrl: string;
    }
  | {
      kind: "added";
      email: string;
      name: string;
      orgName: string;
      loginUrl: string;
    };

export async function sendInmoStaffNotifyEmail(
  redirectTo: string,
  payload: StaffNotifyPayload,
): Promise<void> {
  const landingOrigin = new URL(redirectTo).origin;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

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
    throw new Error(detail || "No se pudo enviar el correo de invitación");
  }
}
