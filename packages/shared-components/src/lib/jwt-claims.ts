import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readJwtAppMetadata(
  session: Session | null,
): Record<string, unknown> {
  const token = session?.access_token;
  if (!token) return {};
  const payload = decodeJwtPayload(token);
  const meta = payload?.app_metadata;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

function readUserAppMetadata(session: Session | null): Record<string, unknown> {
  const meta = session?.user?.app_metadata;
  return meta && typeof meta === "object" ? meta : {};
}

function hasMustSetPasswordFlag(meta: Record<string, unknown>): boolean {
  return meta.must_set_password === true || meta.must_set_password === "true";
}

/** True when the user must choose a new password before using the app. */
export function mustSetPassword(session: Session | null): boolean {
  if (!session) return false;
  if (hasMustSetPasswordFlag(readJwtAppMetadata(session))) return true;
  if (hasMustSetPasswordFlag(readUserAppMetadata(session))) return true;
  return false;
}

/** Prefer this after sign-in — reads fresh app_metadata from Auth (not only JWT claims). */
export async function fetchMustSetPassword(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  const meta = data.user.app_metadata;
  if (!meta || typeof meta !== "object") return false;
  return hasMustSetPasswordFlag(meta as Record<string, unknown>);
}

export function landingApiBase(fallbackOrigin?: string): string {
  if (typeof window !== "undefined") {
    const envBase = (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_NODO_LANDING_URL;
    if (envBase?.trim()) return envBase.replace(/\/$/, "");
    if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
    return window.location.origin;
  }
  return fallbackOrigin?.replace(/\/$/, "") ?? "";
}

export async function completeForcedPassword(params: {
  supabase: SupabaseClient;
  password: string;
  confirmPassword: string;
  landingApiBaseUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, password, confirmPassword, landingApiBaseUrl } = params;

  if (password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: "La sesión expiró. Volvé a iniciar sesión." };
  }

  const base = landingApiBaseUrl ?? landingApiBase();
  const res = await fetch(`${base}/api/auth/complete-forced-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password, confirmPassword }),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "No se pudo actualizar la contraseña." };
  }

  await supabase.auth.refreshSession();
  return { ok: true };
}
