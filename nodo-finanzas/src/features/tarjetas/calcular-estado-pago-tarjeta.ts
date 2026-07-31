import type { ConsumoTarjeta, GastoDiario } from '@/types';

export interface EstadoPagoTarjetaMes {
  totalARS: number;
  totalUSD: number;
  pagada: boolean;
  pagoParcial: boolean;
  montoPagado: number;
  restanteARS: number;
  /** true cuando "pagada" viene del check manual (tarjeta.ultimoPagoMes), no de un
   * gasto real — Deshacer debe limpiar ese campo en vez de borrar un gasto. */
  marcadaSinGasto: boolean;
}

/**
 * Consumo y estado de pago de una tarjeta para un mes calendario puntual
 * ('YYYY-MM'). El pago se busca en ese mismo mes — no en el mes de
 * fechaVencimiento de la tarjeta, que puede no coincidir con el mes que se
 * está mirando y llevaba a totales desalineados entre pantallas.
 *
 * Un gasto real (pagoTarjetaId) siempre tiene prioridad. Si no hay ninguno,
 * tarjeta.ultimoPagoMes === mes marca la tarjeta como pagada "a mano" (check
 * "Marcar como pagada", sin crear ningún gasto ni mover dinero de ninguna
 * cuenta) — mismo campo que ya usa el flujo de pago real para dejar rastro
 * de qué mes se pagó (ver useFinanzas.agregarGastoDiario).
 */
export function calcularEstadoPagoTarjetaMes(
  tarjeta: { id: string; ultimoPagoMes?: string },
  consumosTarjetas: ConsumoTarjeta[],
  gastosDiarios: GastoDiario[],
  mes: string,
): EstadoPagoTarjetaMes {
  const consumosDelMes = consumosTarjetas.filter((c) => {
    const anioMes = new Date(c.fecha).toISOString().slice(0, 7);
    return c.tarjetaId === tarjeta.id && anioMes === mes;
  });

  const totalARS = consumosDelMes.reduce((a, c) => a + (c.importeARS || 0), 0);
  const totalUSD = consumosDelMes.reduce((a, c) => a + (c.importeUSD || 0), 0);

  const gastoPago = gastosDiarios.find(
    (g) => g.pagoTarjetaId === tarjeta.id && g.fecha.startsWith(mes),
  );

  if (gastoPago) {
    return {
      totalARS,
      totalUSD,
      pagada: !gastoPago.pagoParcial,
      pagoParcial: !!gastoPago.pagoParcial,
      montoPagado: gastoPago.monto || 0,
      restanteARS: Math.max(0, totalARS - (gastoPago.monto || 0)),
      marcadaSinGasto: false,
    };
  }

  const marcadaSinGasto = tarjeta.ultimoPagoMes === mes;

  return {
    totalARS,
    totalUSD,
    pagada: marcadaSinGasto,
    pagoParcial: false,
    montoPagado: 0,
    restanteARS: totalARS,
    marcadaSinGasto,
  };
}

/** Monto en ARS que todavía se debe de ese mes: 0 si está pagada, el resto si es pago parcial, el total si no se pagó nada. */
export function montoAdeudado(estado: EstadoPagoTarjetaMes): number {
  if (estado.pagada) return 0;
  if (estado.pagoParcial) return estado.restanteARS;
  return estado.totalARS;
}
