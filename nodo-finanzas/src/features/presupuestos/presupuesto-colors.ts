/** Clases de color según el consumo del presupuesto — compartidas entre la
 * pantalla de Presupuestos y la card resumen del dashboard. */

export function barraColor(porcentaje: number, excedido: boolean): string {
  if (excedido) return 'bg-red-500';
  if (porcentaje >= 80) return 'bg-amber-500';
  return 'bg-brand';
}

export function textoColor(porcentaje: number, excedido: boolean): string {
  if (excedido) return 'text-red-600';
  if (porcentaje >= 80) return 'text-amber-600';
  return 'text-brand';
}
