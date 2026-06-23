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
