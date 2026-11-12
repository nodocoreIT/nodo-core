import { describe, expect, it } from 'vitest';
import type { ConsumoTarjeta } from '@/types';
import { montoImpuestos } from './impuestos-tarjeta';

function consumo(parcial: Partial<ConsumoTarjeta> & Pick<ConsumoTarjeta, 'id' | 'lugar' | 'importeARS'>): ConsumoTarjeta {
  return {
    tarjetaId: 'visa',
    fecha: '2026-11-01',
    detalle: null,
    ...parcial,
  };
}

describe('montoImpuestos', () => {
  it('suma solo los impuestos de esa tarjeta y ese mes', () => {
    const consumos = [
      consumo({ id: '1', lugar: 'Impuestos', importeARS: 22000 }),
      consumo({ id: '2', lugar: 'Intereses de Financiación', importeARS: 1500 }),
      consumo({ id: '3', lugar: 'Impuestos', importeARS: 800, tarjetaId: 'otra' }),
      consumo({ id: '4', lugar: 'Impuestos', importeARS: 400, fecha: '2026-10-01' }),
    ];

    expect(montoImpuestos(consumos, 'visa', '2026-11')).toBe(22000);
  });
});
