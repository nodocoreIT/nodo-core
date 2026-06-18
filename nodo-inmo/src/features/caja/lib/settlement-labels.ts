/** Etiqueta de honorarios de la inmobiliaria en rendiciones / liquidaciones. */
export const ADMINISTRACION_INMOBILIARIA = "Administración inmobiliaria";
export const ADMINISTRACION_INMOBILIARIA_SHORT = "ADM. INMO.";
export const ADMINISTRACION_INMOBILIARIA_PERCENT = "Adm. Inmobiliaria (%)";

export function administracionInmobiliariaLabel(
  commissionRate: number,
  options?: { short?: boolean },
): string {
  const base = options?.short
    ? ADMINISTRACION_INMOBILIARIA_SHORT
    : ADMINISTRACION_INMOBILIARIA;
  return `${base} (${commissionRate}%)`;
}
