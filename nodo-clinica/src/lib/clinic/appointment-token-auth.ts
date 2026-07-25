import { createServiceClient } from "@/lib/supabase/server";

/**
 * Resolves an appointment by its access_token using the service role client,
 * enforcing token_expires_at server-side. Possessing a valid, non-expired
 * token is treated as sufficient credential to read/act on that ONE
 * appointment (magic-link style) — callers must not use this to grant any
 * broader access than the single appointment it returns.
 */
export async function resolveAppointmentByAccessToken(accessToken: string) {
  if (!accessToken) return null;

  const supabase = await createServiceClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!apt) return null;

  const expiresAt = new Date(apt.token_expires_at).getTime();
  // Fail closed: a missing/unparsable expiry must NOT be treated as "never
  // expires" (Date comparisons against NaN are always false, which would
  // silently let an unexpirable token through).
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return apt;
}
