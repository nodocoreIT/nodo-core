import type { Session } from "@supabase/supabase-js";

/** Decode hook-injected claims from the access token (not session.user.app_metadata). */
export function readJwtClaims(session: Session | null): {
  role: string | null;
  orgId: string | null;
} {
  const token = session?.access_token;
  if (!token) return { role: null, orgId: null };
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      role: payload.app_metadata?.role ?? null,
      orgId: payload.app_metadata?.org_id ?? null,
    };
  } catch {
    return { role: null, orgId: null };
  }
}
