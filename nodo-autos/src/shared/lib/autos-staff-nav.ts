/**
 * Role configuration constants for nodo-autos staff management.
 *
 * Display labels → JWT roles:
 *   Administrador → admin
 *   Vendedor      → seller
 *   Invitado      → guest
 *
 * Callers should pass the DB role directly (e.g. "seller") rather than
 * the display label "Vendedor" to avoid the DISPLAY_TO_DB_ROLE fallback
 * resolving incorrectly for inmo-specific mappings.
 */

/** Role options shown in invite/update dropdowns (excludes admin — managed via promotion). */
export const AUTOS_STAFF_ROLE_OPTIONS = [
  { value: "seller", label: "Vendedor" },
  { value: "guest", label: "Invitado" },
] as const;

/** Display label for the admin role. */
export const AUTOS_ADMIN_DISPLAY_ROLE = "Administrador";

/** Display label for the default employee role. */
export const AUTOS_EMPLOYEE_DISPLAY_ROLE = "Vendedor";

/** Roles that always have panel access (gate used by RequireAuth). */
export const AUTOS_FIXED_ACCESS_ROLES = [
  "super_admin",
  "admin",
  "seller",
  "guest",
] as const;

export type AutosAccessRole = (typeof AUTOS_FIXED_ACCESS_ROLES)[number];
