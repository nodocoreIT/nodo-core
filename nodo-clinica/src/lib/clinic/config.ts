/**
 * Local demo mode: true only when Supabase is not configured OR
 * NEXT_PUBLIC_CLINIC_MODE=local is explicitly set.
 * In production (Supabase URL + key present), this is always false.
 */
export function isLocalMode(): boolean {
  if (process.env.NEXT_PUBLIC_CLINIC_MODE === "local") return true;
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** @deprecated use isLocalMode() */
export const USE_SUPABASE_AUTH = !isLocalMode();

/** Client-side: Supabase browser client only when URL+key exist and not local demo mode. */
export function isBrowserSupabaseEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CLINIC_MODE === "local") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export const DEMO_CREDENTIALS = {
  doctor: { email: "juanmendia@gmail.com", password: "Peladin18" },
  patient: { email: "ramirotule@gmail.com", password: "Miba1216" },
};
