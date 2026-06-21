/** Admin routes that require Plan Pro (sidebar lock + route PlanGate). */
export const PRO_ONLY_ADMIN_ROUTES = [
  "/admin/portal",
  "/admin/reclamos",
] as const;

export type ProOnlyAdminRoute = (typeof PRO_ONLY_ADMIN_ROUTES)[number];

export function isProOnlyAdminRoute(path: string): path is ProOnlyAdminRoute {
  return (PRO_ONLY_ADMIN_ROUTES as readonly string[]).includes(path);
}

export const PRO_PLAN_BENEFITS = [
  "Portales propietario e inquilino",
  "Reclamos y seguimiento",
  "Nodo ID para conectar con otros nodos Pro",
  "Bot, automatizaciones e integraciones",
] as const;

/** Shortcuts shown in the Pro badge dropdown. */
export const PRO_QUICK_LINKS = [
  { to: "/admin/portal", label: "Portales propietario e inquilino" },
  { to: "/admin/reclamos", label: "Reclamos y seguimiento" },
] as const;
