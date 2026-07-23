import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessAsRole,
  lookupClinicMembershipByEmail,
  parseClinicDbRole,
  sessionRoleToDbRole,
  type ClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any>;

export const PATIENT_NOT_REGISTERED_MESSAGE =
  "No existe un paciente registrado con ese correo.";

export const DOCTOR_NOT_REGISTERED_MESSAGE =
  "No existe un médico registrado con ese correo.";

export function portalNotRegisteredMessage(role: ClinicDbRole): string {
  return role === "medico"
    ? DOCTOR_NOT_REGISTERED_MESSAGE
    : PATIENT_NOT_REGISTERED_MESSAGE;
}

export function parsePortalLoginRole(
  role: string | undefined | null,
): ClinicDbRole | null {
  return parseClinicDbRole(role) ?? (role === "doctor" ? "medico" : role === "patient" ? "paciente" : null);
}

export async function checkPortalLoginEligibility(
  service: ServiceClient,
  email: string,
  role: ClinicDbRole | "doctor" | "patient",
): Promise<{ eligible: true } | { eligible: false; message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { eligible: false, message: "Ingresá un email válido." };
  }

  const dbRole =
    role === "doctor" || role === "patient"
      ? sessionRoleToDbRole(role)
      : role;

  const membership = await lookupClinicMembershipByEmail(service, normalized);
  if (canAccessAsRole(membership, dbRole)) {
    return { eligible: true };
  }

  return {
    eligible: false,
    message: portalNotRegisteredMessage(dbRole),
  };
}
