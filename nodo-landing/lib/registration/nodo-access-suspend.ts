import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { authAdminForUnitCode, resolveAuthUserForUnit } from "@/lib/registration/client-unit-auth";

export type NodoSuspendAction = "suspend" | "reactivate";

export async function setNodoAuthSuspended(
  unitCode: string,
  userId: string,
  action: NodoSuspendAction,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createNodoAdminClient(unitCode);
  if (!admin) {
    return { ok: false, error: `El nodo "${unitCode}" no está configurado.` };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: action === "suspend" ? "876600h" : "none",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Lift auth ban when (re)activating access — idempotent if already active. */
export async function ensureNodoAuthActive(
  unitCode: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return setNodoAuthSuspended(unitCode, userId, "reactivate");
}

/** Suspend or lift ban on the nodo Auth user tied to a client unit. */
export async function setNodoAuthSuspendedForUnit(
  unitCode: string,
  unit: {
    provision_user_id: string | null;
    access_user: string | null;
  },
  action: NodoSuspendAction,
): Promise<{ ok: true; userId?: string } | { ok: false; error: string }> {
  const authAdmin = authAdminForUnitCode(unitCode);
  const resolved = await resolveAuthUserForUnit(authAdmin, unit);
  if (!resolved) {
    if (action === "reactivate") return { ok: true };
    return { ok: false, error: "No se encontró usuario de acceso en el nodo." };
  }

  const result = await setNodoAuthSuspended(unitCode, resolved.userId, action);
  if (!result.ok) return result;
  return { ok: true, userId: resolved.userId };
}
