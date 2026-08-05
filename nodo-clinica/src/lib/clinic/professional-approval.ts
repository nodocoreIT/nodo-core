import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any>;

/**
 * Shown to a médico who finished onboarding but hasn't been approved yet
 * (professionals.enabled_at is still NULL — see the migration comment on
 * that column). Kept distinct from portal-login-eligibility's messages:
 * this gate fires *after* successful auth, not at login time.
 */
export const PROFESSIONAL_PENDING_APPROVAL_MESSAGE =
  "Tu cuenta está pendiente de aprobación de Nodocore. Te avisaremos por email en cuanto esté habilitada.";

export const PROFESSIONAL_PENDING_APPROVAL_CODE = "pending_approval";

/**
 * True once an admin approved the clinic registration
 * (POST /api/admin/clinic-registrations in nodo-landing sets enabled_at).
 * NULL means onboarding finished but nobody clicked "Habilitar" in
 * /panel/solicitudes-pendientes yet — the médico must not be able to use
 * the panel until then, even though auth already succeeded.
 */
export async function isProfessionalEnabled(
  service: ServiceClient,
  professionalId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("professionals")
    .select("enabled_at")
    .eq("id", professionalId)
    .maybeSingle();

  if (error) {
    // Fail-closed on purpose (security gate) — but logged distinctly from a
    // legitimate "not approved yet" so a transient DB error doesn't read as
    // a silent rejection in the logs.
    console.error(
      "[professional-approval] isProfessionalEnabled query failed, denying access",
      error,
    );
    return false;
  }

  return !!(data as { enabled_at: string | null } | null)?.enabled_at;
}
