/**
 * Role constants for nodo-finanzas.
 * All members share identical permissions (family sharing model).
 * super_admin is the only role that can manage org members via the settings dialog.
 */

export const FINANZAS_STAFF_ROLE_OPTIONS = [
  { value: "member", label: "Miembro" },
] as const;

export const FINANZAS_ADMIN_DISPLAY_ROLE = "Super Admin";

export const FINANZAS_FIXED_ACCESS_ROLES = ["super_admin"] as const;

export type FinanzasAccessRole = "super_admin" | "member";
