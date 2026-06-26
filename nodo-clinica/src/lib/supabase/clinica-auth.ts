/** Cookie / storage namespace for the nodo clinica app only. */
export const CLINICA_AUTH_COOKIE_NAME = "nodo-auth-clinica";

export const clinicaSupabaseClientOptions = {
  db: { schema: "nodo_clinica" },
  cookieOptions: {
    name: CLINICA_AUTH_COOKIE_NAME,
  },
} as const;
