type CuentaLike = {
  id: string;
  nombre: string;
  activa?: boolean;
  tipo?: string;
};

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, '');
}

/**
 * Default Cuenta/Caja for a payment method:
 * - DEBITO / TRANSFERENCIA → Caja de Ahorro Santander
 * - MERCADO_PAGO → Mercadopago (no reservas)
 * - EFECTIVO → Efectivo
 */
export function cuentaIdPorFormaPago(
  formaPago: string,
  cuentas: CuentaLike[],
): string {
  const activas = cuentas.filter((c) => c.activa !== false);
  if (!activas.length) return '';

  if (formaPago === 'EFECTIVO') {
    return (
      activas.find((c) => norm(c.nombre) === 'efectivo')?.id ??
      activas.find((c) => norm(c.nombre).includes('efectivo'))?.id ??
      activas.find((c) => c.tipo === 'EFECTIVO')?.id ??
      ''
    );
  }

  if (formaPago === 'MERCADO_PAGO') {
    return (
      activas.find((c) => {
        const n = norm(c.nombre);
        return (n.includes('mercadopago') || n.includes('mercado')) && !n.includes('reserva');
      })?.id ?? ''
    );
  }

  if (formaPago === 'DEBITO' || formaPago === 'TRANSFERENCIA BANCO') {
    return (
      activas.find((c) => {
        const n = norm(c.nombre);
        return n.includes('santander') && (n.includes('caja') || n.includes('ahorro')) && !n.includes('pampa');
      })?.id ??
      activas.find((c) => {
        const n = norm(c.nombre);
        return n.includes('santander') && !n.includes('pampa');
      })?.id ??
      ''
    );
  }

  return '';
}
