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

/** Server-safe copy of shared-components readJwtAppMetadata (evita importar el barrel en API routes). */
export function readJwtAppMetadata(
  session: Session | null,
): Record<string, unknown> {
  const token = session?.access_token;
  if (!token) return {};
  const payload = decodeJwtPayload(token);
  const meta = payload?.app_metadata;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}
