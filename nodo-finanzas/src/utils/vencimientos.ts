/**
 * Helpers for month-scoped due dates (préstamos / planes / dashboard labels).
 * Stored fechaVencimiento often lags behind after a month rollover; these
 * project to the current calendar month so "Próximos Vencimientos" doesn't
 * keep showing June/July as "vence hoy".
 */

export function fechaEnMes(year: number, month1to12: number, dia: number): string {
  const maxDay = new Date(year, month1to12, 0).getDate();
  const day = Math.min(Math.max(1, dia), maxDay);
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Due date for this month's installment.
 * Prefer diaPago; otherwise reuse the day-of-month from fechaVencimiento.
 */
export function vencimientoCuotaMesEnCurso(
  opts: { diaPago?: number | null; fechaVencimiento?: string | null },
  hoy: Date = new Date(),
): string | null {
  const year = hoy.getFullYear();
  const month = hoy.getMonth() + 1;

  if (opts.diaPago != null && opts.diaPago >= 1 && opts.diaPago <= 31) {
    return fechaEnMes(year, month, opts.diaPago);
  }

  if (!opts.fechaVencimiento) return null;
  const day = Number(opts.fechaVencimiento.slice(8, 10));
  if (!Number.isFinite(day) || day < 1) return opts.fechaVencimiento;
  return fechaEnMes(year, month, day);
}

export function diasHastaFecha(fechaISO: string, hoy: Date = new Date()): number {
  const start = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const end = new Date(fechaISO.slice(0, 10) + 'T12:00:00');
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function labelDiasVencimiento(diffDays: number): string {
  if (diffDays < 0) {
    return diffDays === -1 ? 'vencido hace 1 día' : `vencido hace ${-diffDays} días`;
  }
  if (diffDays === 0) return 'vence hoy';
  if (diffDays === 1) return 'vence mañana';
  return `vence en ${diffDays} días`;
}
