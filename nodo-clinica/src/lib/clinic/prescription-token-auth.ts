import { createServiceClient } from "@/lib/supabase/server";

/**
 * Resolves a prescription by its access_token using the service role client,
 * enforcing token_expires_at server-side. Possessing a valid, non-expired
 * token is treated as sufficient credential to read that ONE prescription
 * (magic-link style, mirrors resolveAppointmentByAccessToken) — callers must
 * not use this to grant any broader access than the single receta it
 * returns.
 */
export async function resolvePrescriptionByAccessToken(accessToken: string) {
  if (!accessToken) return null;

  // The generated Database type for `prescriptions` predates the Fase 2
  // standalone-recetas migration (access_token/token_expires_at/patient_id
  // nullable/etc aren't in it yet) — same untyped-cast pattern already used
  // for this table in the Fase 2 POST route and for `institutions` in
  // account/register + account/verify.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;
  const { data: prescription } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!prescription) return null;

  const expiresAt = new Date(prescription.token_expires_at).getTime();
  // Fail closed: a missing/unparsable expiry must NOT be treated as "never
  // expires" (Date comparisons against NaN are always false, which would
  // silently let an unexpirable token through).
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return prescription;
}
