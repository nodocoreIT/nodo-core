const LOCAL_HOST = /localhost|127\.0\.0\.1/i;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Env-based public origin (build / server). */
export function configuredPublicOrigin(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${stripTrailingSlash(production)}`;

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${stripTrailingSlash(preview)}`;

  return undefined;
}

export function isLocalOrigin(origin: string): boolean {
  try {
    return LOCAL_HOST.test(new URL(origin).hostname);
  } catch {
    return LOCAL_HOST.test(origin);
  }
}

/**
 * Resolve the public base URL for auth redirects and email links.
 * Prefer NEXT_PUBLIC_APP_URL in every deployed environment.
 */
export function resolvePublicOrigin(clientOrigin?: string): string {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  if (clientOrigin && !isLocalOrigin(clientOrigin)) {
    return stripTrailingSlash(clientOrigin);
  }

  if (process.env.NODE_ENV === "development") {
    return stripTrailingSlash(clientOrigin ?? "http://localhost:3000");
  }

  if (clientOrigin) return stripTrailingSlash(clientOrigin);

  console.warn(
    "[auth] NEXT_PUBLIC_APP_URL is unset in production; password-reset links may point to localhost.",
  );
  return "http://localhost:3000";
}

/** Server-only: prefer request host over client-supplied origin. */
export async function resolvePublicOriginFromRequest(
  clientOrigin?: string,
): Promise<string> {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim();
    const hostname = host?.split(":")[0] ?? "";
    if (host && !LOCAL_HOST.test(hostname)) {
      return stripTrailingSlash(`${proto}://${host}`);
    }
  } catch {
    // outside request context
  }

  return resolvePublicOrigin(clientOrigin);
}

/** Redirect URLs that must be allow-listed in Supabase Auth → URL Configuration. */
export const SUPABASE_AUTH_REDIRECT_URLS = [
  "https://www.nodocore.com.ar/**",
  "https://nodocore.com.ar/**",
  "http://localhost:3000/**",
] as const;
