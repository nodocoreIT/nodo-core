import { describe, expect, it } from 'vitest';
import { fechasCuotasPendientes } from './vencimientos';

describe('fechasCuotasPendientes', () => {
  it('conserva las cuotas ya vencidas y la del mes en curso', () => {
    const hoy = new Date(2026, 10, 12);
    expect(fechasCuotasPendientes('2026-09-20', hoy)).toEqual([
      '2026-09-20',
      '2026-10-20',
      '2026-11-20',
    ]);
  });

  it('si la cuota de este mes ya venció, deja también la del mes que entra si falta menos de un mes', () => {
    const hoy = new Date(2026, 10, 12);
    expect(fechasCuotasPendientes('2026-11-05', hoy)).toEqual([
      '2026-11-05',
      '2026-12-05',
    ]);
  });
});
