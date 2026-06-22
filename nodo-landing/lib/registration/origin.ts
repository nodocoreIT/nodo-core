import {
  resolvePublicOrigin,
  resolvePublicOriginFromRequest,
} from "@/lib/auth/public-origin";

export {
  configuredPublicOrigin,
  isLocalOrigin,
  resolvePublicOrigin,
  resolvePublicOriginFromRequest,
  SUPABASE_AUTH_REDIRECT_URLS,
} from "@/lib/auth/public-origin";

/** @deprecated Use resolvePublicOrigin — kept for existing imports. */
export function resolveRegistrationOrigin(clientOrigin?: string): string {
  return resolvePublicOrigin(clientOrigin);
}
