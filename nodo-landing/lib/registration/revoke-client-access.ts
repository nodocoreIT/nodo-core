import { createAdminClient } from "@/lib/supabase/admin";
import { NODES } from "@/lib/nodes";
import {
  isClinicaUnitCode,
  revokeClinicaPortalAccess,
} from "@/lib/registration/clinica-provision";
import {
  setNodoAuthSuspended,
  setNodoAuthSuspendedForUnit,
} from "@/lib/registration/nodo-access-suspend";
import { authAdminForUnitCode, resolveAuthUserForUnit } from "@/lib/registration/client-unit-auth";

type ClientUnitRow = {
  id: string;
  unit_code: string;
  provision_user_id: string | null;
  access_user: string | null;
  plan?: string | null;
};

/** Ban nodo auth user + remove clinica portal profile for one contracted unit. */
export async function revokeClientUnitAccess(
  unit: ClientUnitRow,
): Promise<{ ok: true; userId?: string } | { ok: false; error: string }> {
  const nodeDef = NODES.find((node) => node.code === unit.unit_code);
  if (!nodeDef?.provisionable) {
    return { ok: true };
  }

  let userId = unit.provision_user_id;

  if (!userId && unit.access_user) {
    const authAdmin = authAdminForUnitCode(unit.unit_code);
    const resolved = await resolveAuthUserForUnit(authAdmin, unit);
    userId = resolved?.userId ?? null;
  }

  if (userId) {
    const banned = await setNodoAuthSuspended(unit.unit_code, userId, "suspend");
    if (!banned.ok) return banned;
  } else if (unit.access_user) {
    const banned = await setNodoAuthSuspendedForUnit(unit.unit_code, unit, "suspend");
    if (!banned.ok) return banned;
    userId = banned.userId ?? null;
  }

  if (isClinicaUnitCode(unit.unit_code)) {
    const normalizedEmail = unit.access_user?.trim().toLowerCase() ?? null;
    if (normalizedEmail) {
      const landingAdmin = createAdminClient();
      await landingAdmin
        .from("node_email_access")
        .delete()
        .eq("email", normalizedEmail)
        .eq("unit_code", unit.unit_code);
    }

    const revoked = await revokeClinicaPortalAccess({
      email: unit.access_user,
      userId,
      portalRole: "both",
    });
    if (!revoked.ok) return revoked;
  }

  return { ok: true, userId: userId ?? undefined };
}

/** Revoke all nodo access for a client, then delete the client row (cascade). */
export async function deleteClientsWithAccessRevoke(
  clientIds: string[],
): Promise<
  | { ok: true; deleted: number; warnings?: string[] }
  | { ok: false; error: string; partial?: string[] }
> {
  if (clientIds.length === 0) {
    return { ok: true, deleted: 0 };
  }

  const admin = createAdminClient();
  const warnings: string[] = [];

  const { data: units, error: unitsError } = await admin
    .from("client_units")
    .select("id, unit_code, provision_user_id, access_user, plan, client_id")
    .in("client_id", clientIds);

  if (unitsError) {
    return { ok: false, error: unitsError.message };
  }

  for (const unit of (units ?? []) as ClientUnitRow[]) {
    const result = await revokeClientUnitAccess(unit);
    if (!result.ok) {
      warnings.push(`${unit.unit_code}: ${result.error}`);
    }
  }

  const { error: deleteError } = await admin.from("clients").delete().in("id", clientIds);

  if (deleteError) {
    return {
      ok: false,
      error: deleteError.message,
      partial: warnings.length > 0 ? warnings : undefined,
    };
  }

  return { ok: true, deleted: clientIds.length, warnings };
}
