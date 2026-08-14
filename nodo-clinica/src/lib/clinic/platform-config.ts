import type { AuthConfig } from "@/lib/nodo/auth-config";
import { isLocalMode } from "@/lib/clinic/config";

/**
 * Mismo flujo que Nodo Inmo — registro vía nodocore.com.ar.
 * Apunta directo a "www": el dominio apex devuelve un 308 a www.nodocore.com.ar,
 * y ese salto rompía las llamadas server-to-server (notifyOnboardingCompleted
 * nunca llegaba a nodo-landing — el request se resolvía en el redirect antes
 * de tocar el route handler).
 */
export const NODO_LANDING_URL =
  process.env.NEXT_PUBLIC_NODO_LANDING_URL?.replace(/\/$/, "") ??
  "https://www.nodocore.com.ar";

export const CLINICA_REGISTRATION_URL =
  process.env.NEXT_PUBLIC_CLINICA_REGISTRATION_URL ??
  `${NODO_LANDING_URL}/nodo-clinica/login?mode=register`;

export const CLINICA_UNIT_CODES = ["clinica", "Clínica", "salud", "Salud"] as const;

export const CLINICA_AUTH_CONFIG: AuthConfig = {
  // Must match nodo_core.client_units/planes.unit_code exactly ("Clínica",
  // capitalized with accent) — user_has_node_access does an exact string
  // match, no case/accent folding. Previously "clinica" (lowercase, no
  // accent), which never matched and made AuthProvider's session validation
  // silently no-op (no visible effect since nothing consumed useAuth() here
  // until the billing-lockout gate).
  unitCode: "Clínica",
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
