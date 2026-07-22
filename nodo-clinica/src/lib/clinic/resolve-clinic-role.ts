import type { SupabaseClient } from "@supabase/supabase-js";

export type ClinicDbRole = "medico" | "paciente";

export interface ClinicMembership {
  professionalId: string | null;
  professionalUserId: string | null;
  patientId: string | null;
  patientProfileId: string | null;
}

export interface ResolvedClinicRole extends ClinicMembership {
  role: ClinicDbRole;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any>;

export function parseClinicDbRole(
  value: string | null | undefined,
): ClinicDbRole | null {
  if (value === "medico" || value === "doctor") return "medico";
  if (value === "paciente" || value === "patient") return "paciente";
  return null;
}

export async function lookupClinicMembershipByEmail(
  service: ServiceClient,
  email: string,
): Promise<ClinicMembership> {
  const normalized = email.trim().toLowerCase();

  const { data: professional } = await service
    .from("professionals")
    .select("id, user_id")
    .eq("email", normalized)
    .maybeSingle();

  const { data: patient } = await service
    .from("patients")
    .select("id, profile_id")
    .eq("email", normalized)
    .maybeSingle();

  return {
    professionalId: professional?.id ?? null,
    professionalUserId: professional?.user_id ?? null,
    patientId: patient?.id ?? null,
    patientProfileId: patient?.profile_id ?? null,
  };
}

export async function lookupClinicMembershipByAuthUserId(
  service: ServiceClient,
  authUserId: string,
  email?: string | null,
): Promise<ClinicMembership> {
  const { data: professional } = await service
    .from("professionals")
    .select("id, user_id")
    .eq("user_id", authUserId)
    .maybeSingle();

  const { data: patientByProfile } = await service
    .from("patients")
    .select("id, profile_id")
    .eq("profile_id", authUserId)
    .maybeSingle();

  if (professional || patientByProfile) {
    return {
      professionalId: professional?.id ?? null,
      professionalUserId: professional?.user_id ?? null,
      patientId: patientByProfile?.id ?? null,
      patientProfileId: patientByProfile?.profile_id ?? null,
    };
  }

  if (email) {
    return lookupClinicMembershipByEmail(service, email);
  }

  return {
    professionalId: null,
    professionalUserId: null,
    patientId: null,
    patientProfileId: null,
  };
}

export function canAccessAsRole(
  membership: ClinicMembership,
  role: ClinicDbRole,
): boolean {
  if (role === "medico") return !!membership.professionalId;
  return !!membership.patientId;
}

/** Pick portal role; when dual account, honour intended tab/flow role. */
export function resolveRoleForContext(
  membership: ClinicMembership,
  intendedRole?: ClinicDbRole | null,
): ResolvedClinicRole {
  const hasProfessional = !!membership.professionalId;
  const hasPatient = !!membership.patientId;

  let role: ClinicDbRole;
  if (hasProfessional && hasPatient) {
    role = intendedRole === "paciente" ? "paciente" : "medico";
  } else if (hasProfessional) {
    role = "medico";
  } else if (hasPatient) {
    role = "paciente";
  } else {
    role = intendedRole === "medico" ? "medico" : "paciente";
  }

  return { role, ...membership };
}

/** @deprecated Prefer lookupClinicMembershipByEmail + resolveRoleForContext */
export async function resolveClinicRoleByEmail(
  service: ServiceClient,
  email: string,
  intendedRole?: ClinicDbRole | null,
): Promise<ResolvedClinicRole> {
  const membership = await lookupClinicMembershipByEmail(service, email);
  return resolveRoleForContext(membership, intendedRole);
}

/** @deprecated Prefer lookupClinicMembershipByAuthUserId + resolveRoleForContext */
export async function resolveClinicRoleByAuthUserId(
  service: ServiceClient,
  authUserId: string,
  email?: string | null,
  intendedRole?: ClinicDbRole | null,
): Promise<ResolvedClinicRole> {
  const membership = await lookupClinicMembershipByAuthUserId(
    service,
    authUserId,
    email,
  );
  return resolveRoleForContext(membership, intendedRole);
}

export function toSessionRole(dbRole: ClinicDbRole): "doctor" | "patient" {
  return dbRole === "medico" ? "doctor" : "patient";
}

export function sessionRoleToDbRole(
  role: "doctor" | "patient",
): ClinicDbRole {
  return role === "doctor" ? "medico" : "paciente";
}

export function buildPasswordRecoveryRedirect(
  origin: string,
  intendedRole: ClinicDbRole,
): string {
  const next = `/actualizar-contrasena?role=${intendedRole}`;
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}
