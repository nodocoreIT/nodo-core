import { describe, expect, it } from 'vitest';
import { compararMontoVisible } from './comparar-monto';

describe('compararMontoVisible', () => {
  it('ordena los dólares por su importe y no como si fueran cero pesos', () => {
    const filas = [
      { usd: 4.99 },
      { usd: 47.55 },
      { usd: 20 },
      { usd: 3.01 },
      { usd: 9.99 },
    ];

    const ordenados = [...filas].sort(compararMontoVisible).map((fila) => fila.usd);

    expect(ordenados).toEqual([3.01, 4.99, 9.99, 20, 47.55]);
  });

  it('no mezcla un dólar con un peso de la misma cifra', () => {
    const filas = [{ ars: 20 }, { usd: 9.99 }, { ars: 8 }, { usd: 30 }];

    const ordenados = [...filas].sort(compararMontoVisible);

    expect(ordenados).toEqual([{ ars: 8 }, { ars: 20 }, { usd: 9.99 }, { usd: 30 }]);
  });
});
