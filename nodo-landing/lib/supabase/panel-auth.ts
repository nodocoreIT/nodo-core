/** Cookie / storage namespace for the internal Nodo Core dashboard only. */
export const PANEL_AUTH_COOKIE_NAME = "nodo-auth-panel";

export const panelSupabaseClientOptions = {
  db: { schema: "nodo_core" },
  cookieOptions: {
    name: PANEL_AUTH_COOKIE_NAME,
  },
} as const;
