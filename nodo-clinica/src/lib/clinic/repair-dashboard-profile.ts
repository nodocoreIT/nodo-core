import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupClinicMembership,
  parseClinicDbRole,
  type ClinicMembership,
} from "@/lib/clinic/resolve-clinic-role";

const DEFAULT_CLINIC_ORG_ID =
  process.env.CLINIC_ORG_ID ?? "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any>;

/**
 * Self-heal dashboard-provisioned paciente accounts when the patients row
 * was lost or unlinked (e.g. after a mistaken medico platform-sync).
 */
export async function repairDashboardPacienteProfile(
  service: ServiceClient,
  user: {
    id: string;
    email?: string | null;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
): Promise<ClinicMembership | null> {
  const metaRole = parseClinicDbRole(user.app_metadata?.role as string | undefined);
  if (metaRole !== "paciente" || !user.email?.trim()) {
    return null;
  }

  const email = user.email.trim().toLowerCase();
  const orgId =
    typeof user.app_metadata?.org_id === "string"
      ? user.app_metadata.org_id
      : DEFAULT_CLINIC_ORG_ID;
  const rawName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    email.split("@")[0] ||
    "Paciente";
  const parts = rawName.split(/\s+/);
  const firstName = parts[0] ?? rawName;
  const lastName = parts.slice(1).join(" ") || firstName;

  const { data: existing } = await service
    .from("patients")
    .select("id, profile_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.profile_id !== user.id) {
      await service
        .from("patients")
        .update({ profile_id: user.id })
        .eq("id", existing.id);
    }
  } else {
    const { error: insertError } = await service.from("patients").insert({
      profile_id: user.id,
      org_id: orgId,
      email,
      full_name: rawName,
      first_name: firstName,
      last_name: lastName,
      subscription_plan:
        typeof user.app_metadata?.subscription_plan === "string"
          ? user.app_metadata.subscription_plan
          : null,
    });
    if (insertError && insertError.code !== "23505") {
      console.error("[repair-dashboard-profile] insert patient", insertError);
      return null;
    }
  }

  // Remove mistaken professional row from platform-sync on patient-only accounts
  const { error: delProf } = await service
    .from("professionals")
    .delete()
    .eq("user_id", user.id);
  if (delProf?.code === "23503") {
    await service
      .from("professionals")
      .update({ user_id: null })
      .eq("user_id", user.id);
  }

  return lookupClinicMembership(service, { email, authUserId: user.id });
}
