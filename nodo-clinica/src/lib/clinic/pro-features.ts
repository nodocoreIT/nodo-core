export const PRO_PLAN_BENEFITS = [
  "Interconsultas entre colegas",
  "Nodo ID para ecosistema",
  "Chat Pro y directorio de médicos",
  "Soporte prioritario NodoCore",
];

export const PRO_ONLY_MEDICO_ROUTES = ["/medico/interconsultas"] as const;

export function isProOnlyMedicoRoute(pathname: string): boolean {
  return PRO_ONLY_MEDICO_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
