import type { SupabaseClient } from "@supabase/supabase-js";

/** Shown at login when auth fails or the user has no access to this nodo (same UX). */
export const INVALID_LOGIN_MESSAGE =
  "Credenciales incorrectas. Verificá tu email y contraseña.";

/** @deprecated Use INVALID_LOGIN_MESSAGE — kept for imports that referenced the old name. */
export const ACCESS_DENIED_MESSAGE = INVALID_LOGIN_MESSAGE;

const BANNED_MESSAGE =
  "Tu acceso fue pausado. Contactate con NODO Core para reactivarlo.";

/** Maps Supabase auth login errors to user-friendly Spanish messages. */
export function mapAuthLoginError(message: string | undefined): string {
  const msg = (message ?? "").toLowerCase();
  if (msg.includes("banned") || msg.includes("user_banned") || msg.includes("user is banned")) {
    return BANNED_MESSAGE;
  }
  return INVALID_LOGIN_MESSAGE;
}

/**
 * Returns true when the signed-in user is registered for the given node (unit_code).
 * Uses RPC `user_has_node_access` on the shared Supabase project.
 */
export async function userHasNodeAccess(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<boolean> {
  const code = unitCode.trim();
  if (!code) return false;

  const candidates = [code, code.toLowerCase(), code.charAt(0).toUpperCase() + code.slice(1).toLowerCase()];

  for (const candidate of [...new Set(candidates)]) {
    const { data, error } = await supabase.schema("public").rpc("user_has_node_access", {
      p_unit_code: candidate,
    });

    if (error) {
      console.error("user_has_node_access RPC failed:", error.message);
      return false;
    }

    if (data === true) return true;
  }

  return false;
}

export type NodeAccessReason = "ok" | "payment_overdue" | "banned" | "invalid_credentials";

/**
 * Returns a machine-readable reason alongside the boolean access check, so callers
 * can distinguish `payment_overdue` (client_unit is `impago` — access stays allowed,
 * see userHasNodeAccess/enforceNodeAccess, unaffected) from real denial reasons.
 * Uses RPC `user_node_access_reason` — purely additive, does not gate access itself.
 *
 * Fail-open: any error (network, RPC failure) resolves to `"ok"` — this function must
 * never be the reason a user gets locked out. userHasNodeAccess/enforceNodeAccess remain
 * the sole access decision.
 */
export async function getNodeAccessReason(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<NodeAccessReason> {
  const code = unitCode.trim();
  if (!code) return "ok";

  const { data, error } = await supabase.schema("public").rpc("user_node_access_reason", {
    p_unit_code: code,
  });

  if (error) {
    console.error("user_node_access_reason RPC failed:", error.message);
    return "ok";
  }

  if (
    data === "ok" ||
    data === "payment_overdue" ||
    data === "banned" ||
    data === "invalid_credentials"
  ) {
    return data;
  }

  return "ok";
}

export interface NodeIdentity {
  orgId: string | null;
  role: string | null;
  plan: string | null;
}

/**
 * Resolves role/org/plan SCOPED TO THIS SPECIFIC NODE via `user_node_role`, instead
 * of trusting the raw JWT app_metadata claims — which are a single value shared
 * across every nodo for a given auth user, stamped by whichever nodo the user last
 * onboarded/synced into. An account with legitimate access to multiple nodos would
 * otherwise carry one nodo's role into another's `allowedRoles` gate.
 *
 * Returns `null` when there's no team-membership row for this nodo (e.g. a pure
 * client_units/node_email_access customer with no `org_members` row) — callers
 * should fall back to the JWT-decoded claims in that case, not treat it as denial.
 */
export async function getNodeIdentity(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<NodeIdentity | null> {
  const code = unitCode.trim();
  if (!code) return null;

  const { data, error } = await supabase.schema("public").rpc("user_node_role", {
    p_unit_code: code,
  });

  if (error) {
    console.error("user_node_role RPC failed:", error.message);
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as { org_id?: string | null; role?: string | null; plan?: string | null };
  return {
    orgId: row.org_id ?? null,
    role: row.role ?? null,
    plan: row.plan ?? null,
  };
}

export async function enforceNodeAccess(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const allowed = await userHasNodeAccess(supabase, unitCode);
  if (allowed) return { ok: true };
  await supabase.auth.signOut({ scope: "local" });
  return { ok: false, message: INVALID_LOGIN_MESSAGE };
}

/** Query param value for redirecting back to node login after denied access. */
export const AUTH_ERROR_CREDENTIALS = "credentials";

export function nodeLoginUrlWithAuthError(loginPath: string): string {
  const base = loginPath.startsWith("/") ? loginPath : `/${loginPath}`;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}auth_error=${AUTH_ERROR_CREDENTIALS}`;
}
