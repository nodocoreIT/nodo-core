import type { AuthConfig } from "@/lib/nodo/auth-config";
import { isLocalMode } from "@/lib/clinic/config";

/** Mismo flujo que Nodo Inmo — registro vía nodocore.com.ar */
export const NODO_LANDING_URL =
  process.env.NEXT_PUBLIC_NODO_LANDING_URL?.replace(/\/$/, "") ??
  "https://nodocore.com.ar";

export const CLINICA_REGISTRATION_URL =
  process.env.NEXT_PUBLIC_CLINICA_REGISTRATION_URL ??
  `${NODO_LANDING_URL}/nodo-clinica/login?mode=register`;

export const CLINICA_UNIT_CODES = ["clinica", "Clínica", "salud", "Salud"] as const;

export const CLINICA_AUTH_CONFIG: AuthConfig = {
  unitCode: "clinica",
  allowedRoles: ["super_admin", "admin", "medico", "agent"],
  roleDestinations: {
    super_admin: "/medico/dashboard",
    admin: "/medico/dashboard",
    medico: "/medico/dashboard",
    agent: "/medico/dashboard",
  },
};

export function isPlatformMode(): boolean {
  return !isLocalMode();
}

/** Registro abierto solo en modo local / desarrollo */
export function isOpenRegistrationAllowed(): boolean {
  if (isLocalMode()) return true;
  if (process.env.CLINIC_ALLOW_OPEN_REGISTRATION === "true") return true;
  return process.env.NODE_ENV !== "production";
}
