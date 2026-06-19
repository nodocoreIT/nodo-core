/** Landing hub login — single source of truth for auth across nodes. */
export const LANDING_LOGIN_URL = "/nodo-finanzas/login";

export function redirectToLandingLogin(): void {
  window.location.replace(LANDING_LOGIN_URL);
}
