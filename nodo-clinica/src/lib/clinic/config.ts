/**
 * Feature flag: when true, Supabase Auth is used for login/register/session.
 * When false, the legacy cookie-based session is used as a fallback.
 * Toggle via USE_SUPABASE_AUTH=true in .env.local.
 */
export const USE_SUPABASE_AUTH = process.env.USE_SUPABASE_AUTH === "true";

export function isLocalMode(): boolean {
  return !USE_SUPABASE_AUTH;
}

export const DEMO_CREDENTIALS = {
  doctor: { email: "juanmendia@gmail.com", password: "Peladin18" },
  patient: { email: "ramirotule@gmail.com", password: "Miba1216" },
};
