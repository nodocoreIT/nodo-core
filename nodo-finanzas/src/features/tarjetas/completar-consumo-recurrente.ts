import type { ConsumoTarjeta, RubroConsumo } from '@/types';

type AgregarConsumo = (consumo: Omit<ConsumoTarjeta, 'id'>) => Promise<ConsumoTarjeta | null>;

function mesKey(fechaISO: string): string {
  return fechaISO.slice(0, 7);
}

function fechaEnMes(year: number, month0: number, day: number): string {
  const maxDay = new Date(year, month0 + 1, 0).getDate();
  const d = Math.min(day, maxDay);
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Crea consumos mensuales desde el mes siguiente a `fechaBase` hasta diciembre
 * del mismo año. Omite meses que ya tengan un consumo equivalente
 * (misma tarjeta + lugar + importes).
 */
export async function completarConsumoRecurrenteHastaFinDeAnio(opts: {
  fechaBase: string; // YYYY-MM-DD del cobro original
  tarjetaId: string;
  lugar: string;
  rubro: RubroConsumo | string;
  rubroId?: string;
  detalle?: string | null;
  importeARS: number;
  importeUSD?: number;
  fechaCompra?: string;
  existentes: ConsumoTarjeta[];
  agregarConsumo: AgregarConsumo;
}): Promise<number> {
  const base = new Date(`${opts.fechaBase.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return 0;

  const year = base.getFullYear();
  const day = base.getDate();
  const startMonth = base.getMonth() + 1; // next month (0-indexed)
  let creados = 0;

  for (let month = startMonth; month <= 11; month++) {
    const fecha = fechaEnMes(year, month, day);
    const mk = mesKey(fecha);
    const yaExiste = opts.existentes.some(
      (c) =>
        c.tarjetaId === opts.tarjetaId &&
        c.lugar === opts.lugar &&
        (c.importeARS ?? 0) === (opts.importeARS ?? 0) &&
        (c.importeUSD ?? 0) === (opts.importeUSD ?? 0) &&
        mesKey(c.fecha) === mk,
    );
    if (yaExiste) continue;

    const creado = await opts.agregarConsumo({
      tarjetaId: opts.tarjetaId,
      lugar: opts.lugar,
      fecha: new Date(`${fecha}T12:00:00`).toISOString(),
      fechaCompra: opts.fechaCompra,
      rubro: (opts.rubro || 'OTROS') as RubroConsumo,
      rubroId: opts.rubroId,
      detalle: opts.detalle ?? null,
      importeARS: opts.importeARS,
      importeUSD: opts.importeUSD && opts.importeUSD > 0 ? opts.importeUSD : undefined,
      cuotas: '1 de 1',
      cuotaActual: 1,
      totalCuotas: 1,
      // Generated copies are not templates (avoids infinite loops in auto-gen).
      gastoFijo: false,
      codigoOperacion: crypto.randomUUID(),
    });
    if (creado) {
      creados += 1;
      opts.existentes.push(creado);
    }
  }

  return creados;
}
