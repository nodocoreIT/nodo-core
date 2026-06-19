import { describe, expect, it } from 'vitest';
import { parseGastoDictado } from './parse-gasto-dictado';
import type { Rubro } from '@/types';

const rubros: Rubro[] = [
  {
    id: 'rubro-salud',
    codigo: 'SALUD',
    nombre: 'Salud',
    emoji: '💊',
    color: '#10b981',
    activo: true,
    esSistema: true,
    orden: 1,
  },
  {
    id: 'rubro-alimentacion',
    codigo: 'ALIMENTACION',
    nombre: 'Alimentación',
    emoji: '🍔',
    color: '#f59e0b',
    activo: true,
    esSistema: true,
    orden: 2,
  },
  {
    id: 'rubro-transporte',
    codigo: 'TRANSPORTE',
    nombre: 'Transporte',
    emoji: '🚗',
    color: '#3b82f6',
    activo: true,
    esSistema: true,
    orden: 3,
  },
];

describe('parseGastoDictado', () => {
  it('interpreta gasto médico con mercado pago', () => {
    const result = parseGastoDictado({
      texto: 'hoy tuve un gasto de 250 pesos en el médico pagando con Mercado Pago',
      rubros,
      fechaReferencia: '2026-06-19',
    });

    expect(result.monto).toBe(250);
    expect(result.fecha).toBe('2026-06-19');
    expect(result.formaPago).toBe('MERCADO_PAGO');
    expect(result.rubroId).toBe('rubro-salud');
    expect(result.descripcion?.toLowerCase()).toContain('medico');
    expect(result.confianza).toBeGreaterThan(0.7);
  });

  it('interpreta monto en lucas y rubro de supermercado', () => {
    const result = parseGastoDictado({
      texto: 'ayer gasté 15 lucas en el super con débito',
      rubros,
      fechaReferencia: '2026-06-19',
    });

    expect(result.monto).toBe(15000);
    expect(result.fecha).toBe('2026-06-18');
    expect(result.formaPago).toBe('DEBITO');
    expect(result.rubroId).toBe('rubro-alimentacion');
  });

  it('interpreta nafta en efectivo', () => {
    const result = parseGastoDictado({
      texto: 'pagué 8500 de nafta en efectivo',
      rubros,
      fechaReferencia: '2026-06-19',
    });

    expect(result.monto).toBe(8500);
    expect(result.formaPago).toBe('EFECTIVO');
    expect(result.rubroId).toBe('rubro-transporte');
  });

  it('detecta cuotas en tarjeta', () => {
    const result = parseGastoDictado({
      texto: 'compré ropa por 45000 con tarjeta en 3 cuotas',
      rubros,
      fechaReferencia: '2026-06-19',
    });

    expect(result.monto).toBe(45000);
    expect(result.formaPago).toBe('TARJETA');
    expect(result.cuotas).toBe(3);
  });
});
