/** Admin nav sections configurable per staff member (excludes Automatizaciones). */
export const INMO_MANAGED_NAV = [
  { to: "/admin/dashboard", label: "Inicio" },
  { to: "/admin/properties", label: "Propiedades" },
  { to: "/admin/owners", label: "Propietarios" },
  { to: "/admin/tenants", label: "Inquilinos" },
  { to: "/admin/contracts", label: "Contratos" },
  { to: "/admin/payments", label: "Pagos" },
  { to: "/admin/caja", label: "Caja" },
  { to: "/admin/rendiciones", label: "Rendiciones" },
  { to: "/admin/ganancias", label: "Ganancias" },
  { to: "/admin/documentos", label: "Documentos" },
  { to: "/admin/agenda", label: "Agenda y Tareas" },
  { to: "/admin/reclamos", label: "Reclamos" },
  { to: "/admin/portal", label: "Portales (Pro)" },
] as const;

/** Default panel sections for Empleado (staff). */
export const INMO_DEFAULT_EMPLOYEE_SECTIONS = [
  "/admin/dashboard",
  "/admin/owners",
  "/admin/agenda",
  "/admin/portal",
  "/admin/properties",
  "/admin/tenants",
  "/admin/reclamos",
] as const;

export const INMO_STAFF_ROLE_OPTIONS = [
  { value: "Administrador", label: "Administrador" },
  { value: "Empleado", label: "Empleado" },
  { value: "Propietario", label: "Propietario" },
  { value: "Inquilino", label: "Inquilino" },
] as const;

export const INMO_ADMIN_DISPLAY_ROLE = "Administrador";
export const INMO_EMPLOYEE_DISPLAY_ROLE = "Empleado";
export const INMO_FIXED_ACCESS_ROLES = [
  INMO_ADMIN_DISPLAY_ROLE,
  "Propietario",
  "Inquilino",
] as const;
