import type { ConsumoTarjeta } from '@/types';

export const LUGAR_IMPUESTOS = 'Impuestos';

export function consumosImpuestos(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): ConsumoTarjeta[] {
  return consumos.filter(
    (c) =>
      c.tarjetaId === tarjetaId &&
      c.lugar === LUGAR_IMPUESTOS &&
      c.fecha.slice(0, 7) === mes,
  );
}

export function montoImpuestos(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): number {
  return consumosImpuestos(consumos, tarjetaId, mes).reduce(
    (acc, c) => acc + (c.importeARS || 0),
    0,
  );
}

type FinanzasImpuestos = {
  consumosTarjetas: ConsumoTarjeta[];
  eliminarConsumo: (id: string) => Promise<unknown>;
  actualizarConsumo: (id: string, cambios: Partial<ConsumoTarjeta>) => Promise<unknown>;
  agregarConsumo: (consumo: Omit<ConsumoTarjeta, 'id'>) => Promise<unknown>;
};

export async function guardarImpuestos(
  finanzas: FinanzasImpuestos,
  tarjetaId: string,
  mes: string,
  monto: number,
) {
  const existentes = consumosImpuestos(finanzas.consumosTarjetas, tarjetaId, mes);
  const [primero, ...resto] = existentes;
  for (const extra of resto) {
    await finanzas.eliminarConsumo(extra.id);
  }
  if (primero) {
    if (monto === 0) {
      await finanzas.eliminarConsumo(primero.id);
      return;
    }
    if (Math.abs(monto - (primero.importeARS || 0)) > 0.001) {
      await finanzas.actualizarConsumo(primero.id, { importeARS: monto });
    }
    return;
  }
  if (monto === 0) return;
  await finanzas.agregarConsumo({
    tarjetaId,
    fecha: `${mes}-01`,
    lugar: LUGAR_IMPUESTOS,
    rubro: 'OTROS',
    detalle: 'Impuestos del resumen',
    importeARS: monto,
    cuotas: '1 de 1',
    cuotaActual: 1,
    totalCuotas: 1,
    gastoFijo: false,
  });
}
