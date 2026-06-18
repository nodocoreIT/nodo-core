/** Landing hub login — single source of truth for auth across nodes. */
export const LANDING_LOGIN_URL = "/login";

export function redirectToLandingLogin(): void {
  window.location.replace(LANDING_LOGIN_URL);
}
