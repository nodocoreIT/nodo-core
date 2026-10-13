import type { ConsumoTarjeta } from '@/types';

export const LUGAR_INTERESES_FINANCIACION = 'Intereses de Financiación';

export function consumosInteresesFinanciacion(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): ConsumoTarjeta[] {
  return consumos.filter(
    (c) =>
      c.tarjetaId === tarjetaId &&
      c.lugar === LUGAR_INTERESES_FINANCIACION &&
      c.fecha.slice(0, 7) === mes,
  );
}

export function montoInteresesFinanciacion(
  consumos: ConsumoTarjeta[],
  tarjetaId: string,
  mes: string,
): number {
  return consumosInteresesFinanciacion(consumos, tarjetaId, mes).reduce(
    (acc, c) => acc + (c.importeARS || 0),
    0,
  );
}

type FinanzasIntereses = {
  consumosTarjetas: ConsumoTarjeta[];
  eliminarConsumo: (id: string) => Promise<unknown>;
  actualizarConsumo: (id: string, cambios: Partial<ConsumoTarjeta>) => Promise<unknown>;
  agregarConsumo: (consumo: Omit<ConsumoTarjeta, 'id'>) => Promise<unknown>;
};

export async function guardarInteresesFinanciacion(
  finanzas: FinanzasIntereses,
  tarjetaId: string,
  mes: string,
  monto: number,
  opciones?: { codigoOperacion?: string; detalle?: string },
) {
  const existentes = consumosInteresesFinanciacion(finanzas.consumosTarjetas, tarjetaId, mes);
  const [primero, ...resto] = existentes;
  for (const extra of resto) {
    await finanzas.eliminarConsumo(extra.id);
  }
  if (primero) {
    if (monto === 0) {
      await finanzas.eliminarConsumo(primero.id);
      return;
    }
    const cambioImporte = Math.abs(monto - (primero.importeARS || 0)) > 0.001;
    const cambioOperacion =
      !!opciones?.codigoOperacion && opciones.codigoOperacion !== primero.codigoOperacion;
    if (cambioImporte || cambioOperacion) {
      await finanzas.actualizarConsumo(primero.id, {
        importeARS: monto,
        ...(opciones?.codigoOperacion ? { codigoOperacion: opciones.codigoOperacion } : {}),
      });
    }
    return;
  }
  if (monto === 0) return;
  await finanzas.agregarConsumo({
    tarjetaId,
    fecha: `${mes}-01`,
    lugar: LUGAR_INTERESES_FINANCIACION,
    rubro: 'OTROS',
    detalle: opciones?.detalle ?? 'Intereses de financiación',
    importeARS: monto,
    cuotas: '1 de 1',
    cuotaActual: 1,
    totalCuotas: 1,
    gastoFijo: false,
    ...(opciones?.codigoOperacion ? { codigoOperacion: opciones.codigoOperacion } : {}),
  });
}
