export interface MontoVisible {
  ars?: number;
  usd?: number;
}

/**
 * Compara el monto que se ve en la fila.
 * Un gasto solo en dólares se ordena por su importe en USD; si no, por los pesos.
 * Los dólares quedan juntos, ordenados entre sí, y no se mezclan con un peso de igual cifra.
 */
export function compararMontoVisible(a: MontoVisible, b: MontoVisible): number {
  const arsA = a.ars || 0;
  const arsB = b.ars || 0;
  const usdA = a.usd || 0;
  const usdB = b.usd || 0;
  const soloUsdA = arsA === 0 && usdA !== 0;
  const soloUsdB = arsB === 0 && usdB !== 0;

  if (soloUsdA !== soloUsdB) return soloUsdA ? 1 : -1;
  if (soloUsdA) return usdA - usdB;
  if (arsA !== arsB) return arsA - arsB;
  return usdA - usdB;
}
