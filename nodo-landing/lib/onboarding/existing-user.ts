import type { SupabaseClient } from "@supabase/supabase-js";
import { getNodeMailLabelByCode } from "@/lib/nodes";
import {
  authConfigForUnitCode,
  findAuthUserByEmail,
} from "@/lib/registration/auth-user-lookup";

/** Statuses that mean the person already completed (or started) another nodo. */
const PRIOR_UNIT_STATUSES = [
  "activo",
  "pausado",
  "impago",
  "onboarding",
  "pending_review",
] as const;

export type ExistingOnboardingUser = {
  existingUser: boolean;
  existingNodeLabels: string[];
};

/**
 * Detects whether this email already belongs to the platform
 * (another client_unit and/or an Auth user), so onboarding can skip
 * profile/docs/card and only ask for the new nodo plan.
 */
export async function resolveExistingOnboardingUser(
  admin: SupabaseClient<any, "public", string, any, any>,
  params: {
    email: string;
    clientId: string;
    currentUnitId: string;
    unitCode: string;
  },
): Promise<ExistingOnboardingUser> {
  const email = params.email.trim().toLowerCase();
  const existingNodeLabels: string[] = [];

  const { data: otherUnits } = await admin
    .from("client_units")
    .select("id, unit_code, status")
    .eq("client_id", params.clientId)
    .neq("id", params.currentUnitId)
    .in("status", [...PRIOR_UNIT_STATUSES]);

  for (const unit of otherUnits ?? []) {
    existingNodeLabels.push(getNodeMailLabelByCode(unit.unit_code));
  }

  // Same email may already hold units under another client row (legacy duplicates).
  if (email) {
    const { data: accessRows } = await admin
      .from("node_email_access")
      .select("unit_code, client_unit_id, status")
      .eq("email", email)
      .neq("client_unit_id", params.currentUnitId)
      .in("status", [...PRIOR_UNIT_STATUSES]);

    for (const row of accessRows ?? []) {
      const label = getNodeMailLabelByCode(row.unit_code);
      if (!existingNodeLabels.includes(label)) {
        existingNodeLabels.push(label);
      }
    }
  }

  let hasAuthUser = false;
  if (email) {
    const authConfig = authConfigForUnitCode(params.unitCode);
    if (authConfig) {
      const matched = await findAuthUserByEmail(authConfig, email, admin);
      hasAuthUser = Boolean(matched?.userId);
    }
  }

  return {
    existingUser: existingNodeLabels.length > 0 || hasAuthUser,
    existingNodeLabels,
  };
}
