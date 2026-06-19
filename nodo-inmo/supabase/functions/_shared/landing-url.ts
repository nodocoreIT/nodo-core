/** Public landing base URL for auth redirects and internal mail API. */
export function resolvePublicLandingOrigin(redirectTo: string): string | null {
  const configured = Deno.env.get("NODO_LANDING_URL")?.trim().replace(/\/$/, "");
  if (configured) return configured;

  try {
    const origin = new URL(redirectTo).origin;
    if (/localhost|127\.0\.0\.1/i.test(origin)) return null;
    return origin;
  } catch {
    return null;
  }
}

export function inmoAuthCallbackUrl(landingOrigin: string): string {
  return `${landingOrigin}/inmo/auth/callback`;
}

export function inmoLoginUrl(landingOrigin: string): string {
  return `${landingOrigin}/inmo/login`;
}
