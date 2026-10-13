import { describe, expect, it } from 'vitest';
import type { ConsumoTarjeta } from '@/types';
import { montoInteresesFinanciacion } from './intereses-financiacion';

function consumo(parcial: Partial<ConsumoTarjeta> & Pick<ConsumoTarjeta, 'id' | 'lugar' | 'importeARS'>): ConsumoTarjeta {
  return {
    tarjetaId: 'visa',
    fecha: '2026-10-01',
    detalle: null,
    ...parcial,
  };
}

describe('montoInteresesFinanciacion', () => {
  it('suma solo los intereses de esa tarjeta y ese mes', () => {
    const consumos = [
      consumo({ id: '1', lugar: 'Intereses de Financiación', importeARS: 1500 }),
      consumo({ id: '2', lugar: 'Saldo Pendiente (Pesos)', importeARS: 20000 }),
      consumo({ id: '3', lugar: 'Intereses de Financiación', importeARS: 800, tarjetaId: 'otra' }),
      consumo({ id: '4', lugar: 'Intereses de Financiación', importeARS: 400, fecha: '2026-11-01' }),
    ];

    expect(montoInteresesFinanciacion(consumos, 'visa', '2026-10')).toBe(1500);
  });
});
