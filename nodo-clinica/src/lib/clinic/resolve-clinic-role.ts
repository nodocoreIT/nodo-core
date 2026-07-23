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

  const [{ data: professional }, { data: patient }] = await Promise.all([
    service
      .from("professionals")
      .select("id, user_id, email")
      .ilike("email", normalized)
      .maybeSingle(),
    service
      .from("patients")
      .select("id, profile_id, email")
      .ilike("email", normalized)
      .maybeSingle(),
  ]);

  let membership: ClinicMembership = {
    professionalId: professional?.id ?? null,
    professionalUserId: professional?.user_id ?? null,
    patientId: patient?.id ?? null,
    patientProfileId: patient?.profile_id ?? null,
  };

  // Same auth account can hold both portals — link the sibling profile by user id.
  const authUserId =
    membership.professionalUserId ?? membership.patientProfileId ?? null;

  if (authUserId) {
    if (!membership.professionalId) {
      const { data: profByUser } = await service
        .from("professionals")
        .select("id, user_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (profByUser?.id) {
        membership = {
          ...membership,
          professionalId: profByUser.id,
          professionalUserId: profByUser.user_id ?? authUserId,
        };
      }
    }

    if (!membership.patientId) {
      const { data: patientByProfile } = await service
        .from("patients")
        .select("id, profile_id")
        .eq("profile_id", authUserId)
        .maybeSingle();
      if (patientByProfile?.id) {
        membership = {
          ...membership,
          patientId: patientByProfile.id,
          patientProfileId: patientByProfile.profile_id ?? authUserId,
        };
      }
    }
  }

  return membership;
}

function mergeClinicMembership(
  primary: ClinicMembership,
  secondary: ClinicMembership,
): ClinicMembership {
  return {
    professionalId: primary.professionalId ?? secondary.professionalId,
    professionalUserId:
      primary.professionalUserId ?? secondary.professionalUserId,
    patientId: primary.patientId ?? secondary.patientId,
    patientProfileId: primary.patientProfileId ?? secondary.patientProfileId,
  };
}

/** Resolve membership by email and/or auth user id (union of both lookups). */
export async function lookupClinicMembership(
  service: ServiceClient,
  params: { email?: string | null; authUserId?: string | null },
): Promise<ClinicMembership> {
  const empty: ClinicMembership = {
    professionalId: null,
    professionalUserId: null,
    patientId: null,
    patientProfileId: null,
  };

  let membership = empty;

  if (params.email?.trim()) {
    membership = await lookupClinicMembershipByEmail(service, params.email);
  }

  if (params.authUserId) {
    const byUser = await lookupClinicMembershipByAuthUserId(
      service,
      params.authUserId,
      params.email,
    );
    membership = mergeClinicMembership(membership, byUser);
  }

  return membership;
}

export async function lookupClinicMembershipByAuthUserId(
  service: ServiceClient,
  authUserId: string,
  email?: string | null,
): Promise<ClinicMembership> {
  const [{ data: professional }, { data: patientByProfile }] = await Promise.all([
    service
      .from("professionals")
      .select("id, user_id")
      .eq("user_id", authUserId)
      .maybeSingle(),
    service
      .from("patients")
      .select("id, profile_id")
      .eq("profile_id", authUserId)
      .maybeSingle(),
  ]);

  let membership: ClinicMembership = {
    professionalId: professional?.id ?? null,
    professionalUserId: professional?.user_id ?? null,
    patientId: patientByProfile?.id ?? null,
    patientProfileId: patientByProfile?.profile_id ?? null,
  };

  // Always merge email lookup — a mistaken professionals row (e.g. platform-sync)
  // must not hide a patients row matched only by email.
  if (email?.trim()) {
    membership = mergeClinicMembership(
      membership,
      await lookupClinicMembershipByEmail(service, email),
    );
  }

  return membership;
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

/** Link auth user to patient/professional rows found by email (dashboard provisioning). */
export async function linkClinicMembershipProfiles(
  service: ServiceClient,
  authUserId: string,
  membership: ClinicMembership,
): Promise<ClinicMembership> {
  let linked = { ...membership };

  if (linked.patientId && linked.patientProfileId !== authUserId) {
    await service
      .from("patients")
      .update({ profile_id: authUserId })
      .eq("id", linked.patientId);
    linked = { ...linked, patientProfileId: authUserId };
  }

  if (linked.professionalId && !linked.professionalUserId) {
    await service
      .from("professionals")
      .update({ user_id: authUserId })
      .eq("id", linked.professionalId);
    linked = { ...linked, professionalUserId: authUserId };
  }

  return linked;
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
  const base = origin.replace(/\/$/, "");
  return `${base}/login?mode=reset-password&role=${intendedRole}`;
}
