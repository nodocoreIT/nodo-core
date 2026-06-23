import type { Session } from "@supabase/supabase-js";

/** SPA auth callback path for OAuth / email confirm redirects (not panel). */
export function nodoSpaAuthCallbackPath(next: string): string | null {
  if (next.startsWith("/nodo-inmo") || next.startsWith("/inmo")) return "/inmo/auth/callback";
  if (next.startsWith("/nodo-autos") || next.startsWith("/autos")) return "/autos/auth/callback";
  if (next.startsWith("/nodo-finanzas") || next.startsWith("/finanzas")) return "/finanzas/auth/callback";
  if (next.startsWith("/nodo-clinica") || next.startsWith("/clinica")) return "/clinica/auth/callback";
  return null;
}

export function redirectUrlWithSessionHash(
  requestUrl: string,
  pathname: string,
  session: Session,
  extraHashParams?: Record<string, string>,
): URL {
  const url = new URL(pathname, requestUrl);
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    ...extraHashParams,
  });
  url.hash = hash.toString();
  return url;
}
