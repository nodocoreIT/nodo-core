import type { ConsumoTarjeta } from '@/types';

export const LUGAR_SALDO_MES_ANTERIOR = 'Saldo Pendiente (Pesos)';

export function consumosSaldoMesAnterior(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): ConsumoTarjeta[] {
  return consumos.filter(
    (c) => c.tarjetaId === tarjetaId && c.lugar === LUGAR_SALDO_MES_ANTERIOR && c.fecha.slice(0, 7) === mes,
  );
}

export function montoSaldoMesAnterior(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): number {
  return consumosSaldoMesAnterior(consumos, tarjetaId, mes).reduce(
    (acc, c) => acc + (c.importeARS || 0),
    0,
  );
}

type FinanzasSaldo = {
  consumosTarjetas: ConsumoTarjeta[];
  eliminarConsumo: (id: string) => Promise<unknown>;
  actualizarConsumo: (id: string, cambios: Partial<ConsumoTarjeta>) => Promise<unknown>;
  agregarConsumo: (consumo: Omit<ConsumoTarjeta, 'id'>) => Promise<unknown>;
};

export async function guardarSaldoMesAnterior(
  finanzas: FinanzasSaldo,
  tarjetaId: string,
  mes: string,
  monto: number,
) {
  const existentes = consumosSaldoMesAnterior(finanzas.consumosTarjetas, tarjetaId, mes);
  const [primero, ...resto] = existentes;
  for (const extra of resto) {
    await finanzas.eliminarConsumo(extra.id);
  }
  if (primero) {
    if (monto === 0) await finanzas.eliminarConsumo(primero.id);
    else if (Math.abs(monto - (primero.importeARS || 0)) > 0.001) {
      await finanzas.actualizarConsumo(primero.id, { importeARS: monto });
    }
    return;
  }
  if (monto === 0) return;
  await finanzas.agregarConsumo({
    tarjetaId,
    fecha: `${mes}-01`,
    lugar: LUGAR_SALDO_MES_ANTERIOR,
    rubro: 'OTROS',
    detalle: 'Saldo del mes anterior',
    importeARS: monto,
    cuotas: '1 de 1',
    cuotaActual: 1,
    totalCuotas: 1,
    gastoFijo: false,
  });
}
