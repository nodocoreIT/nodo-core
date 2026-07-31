import { useMemo } from 'react';
import { useFinanzas } from '@/hooks/use-finanzas';
import { usePresupuestos } from '@/hooks/use-presupuestos';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import type { Tarjeta, Prestamo, PlanAhorro } from '@/types';

export interface Notification {
  id: string;
  tipo: 'tarjeta' | 'prestamo' | 'plan' | 'presupuesto';
  entityId: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  urgencia: 'baja' | 'media' | 'alta';
  venceHoy: boolean;
  monto?: number;
  moneda?: 'ARS' | 'USD';
}

function isoAFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fechaHoyIso(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const useNotifications = () => {
  const { tarjetas, prestamos, planesAhorro, gastosDiarios, consumosTarjetas } = useFinanzas();
  const { presupuestos } = usePresupuestos();

  const notifications = useMemo(() => {
    const list: Notification[] = [];
    const hoy = new Date();
    const mesActualIdx = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    const mesActualStr = `${anioActual}-${String(mesActualIdx + 1).padStart(2, '0')}`;
    const hoyIso = fechaHoyIso();

    // Helper para verificar si ya se pagó este mes
    const estaPagado = (tipo: 'tarjeta' | 'prestamo' | 'plan', id: string) => {
      return gastosDiarios.some(g => {
        const fechaGasto = new Date(g.fecha + 'T12:00:00');
        const mismoMes = fechaGasto.getMonth() === mesActualIdx && fechaGasto.getFullYear() === anioActual;

        if (!mismoMes) return false;

        if (tipo === 'tarjeta') return g.pagoTarjetaId === id;
        if (tipo === 'prestamo') return g.prestamoId === id;
        if (tipo === 'plan') return g.planId === id;
        return false;
      });
    };

    // 1. Tarjetas
    tarjetas.forEach((tarjeta: Tarjeta) => {
      if (!tarjeta.activa || !tarjeta.fechaVencimiento) return;
      // estaPagado solo mira gastosDiarios (pago real) — una tarjeta marcada
      // pagada "a mano" (checkbox, sin gasto) también debe dejar de avisar.
      if (estaPagado('tarjeta', tarjeta.id) || tarjeta.ultimoPagoMes === mesActualStr) return;

      const vtoStr = tarjeta.fechaVencimiento;
      const id = `TARJETA-${tarjeta.id}-${vtoStr.substring(0, 7)}`;

      const fechaVencimiento = new Date(vtoStr + 'T00:00:00');
      const diff = fechaVencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        const venceHoy = diffDays <= 0;
        const mesVto = vtoStr.substring(0, 7);
        const montoPeriodo = consumosTarjetas
          .filter((c) => c.tarjetaId === tarjeta.id && c.fecha.startsWith(mesVto))
          .reduce((sum, c) => sum + (c.importeARS ?? 0), 0);
        list.push({
          id,
          tipo: 'tarjeta',
          entityId: tarjeta.id,
          titulo: `Vencimiento ${tarjeta.nombre}`,
          mensaje: venceHoy
            ? `El pago de tu tarjeta ${tarjeta.nombre} vence hoy.`
            : `El pago de tu tarjeta ${tarjeta.nombre} vence el ${isoAFecha(vtoStr)}.`,
          fecha: vtoStr,
          urgencia: diffDays <= 2 ? 'alta' : diffDays <= 5 ? 'media' : 'baja',
          venceHoy,
          monto: montoPeriodo > 0 ? montoPeriodo : undefined,
          moneda: 'ARS',
        });
      }
    });

    // 2. Préstamos
    prestamos.forEach((prestamo: Prestamo) => {
      if (
        !prestamo.activo ||
        !prestamo.fechaVencimiento ||
        prestamo.cuotaAbonada ||
        prestamo.pagado ||
        prestamo.ultimoPagoMes === mesActualStr
      ) return;

      const id = `PRESTAMO-${prestamo.id}-${mesActualStr}`;
      if (estaPagado('prestamo', prestamo.id)) return;

      const fechaVencimiento = new Date(prestamo.fechaVencimiento + 'T00:00:00');
      const diff = fechaVencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        const venceHoy = diffDays <= 0;
        list.push({
          id,
          tipo: 'prestamo',
          entityId: prestamo.id,
          titulo: `Cuota de ${prestamo.concepto}`,
          mensaje: venceHoy
            ? `La cuota de "${prestamo.concepto}" vence hoy.`
            : `La cuota de "${prestamo.concepto}" vence el ${isoAFecha(prestamo.fechaVencimiento)}.`,
          fecha: prestamo.fechaVencimiento,
          urgencia: diffDays <= 2 ? 'alta' : diffDays <= 5 ? 'media' : 'baja',
          venceHoy,
          monto: prestamo.importeCuota,
          moneda: prestamo.moneda,
        });
      }
    });

    // 3. Planes de Ahorro
    planesAhorro.forEach((plan: PlanAhorro) => {
      if (!plan.activa || !plan.fechaVencimiento) return;

      const id = `PLAN_AHORRO-${plan.id}-${mesActualStr}`;
      if (estaPagado('plan', plan.id)) return;

      const fechaVencimiento = new Date(plan.fechaVencimiento + 'T00:00:00');
      const diff = fechaVencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        const venceHoy = diffDays <= 0;
        list.push({
          id,
          tipo: 'plan',
          entityId: plan.id,
          titulo: `Cuota de Plan: ${plan.detalle}`,
          mensaje: venceHoy
            ? `La cuota del plan "${plan.detalle}" vence hoy.`
            : `La cuota del plan "${plan.detalle}" vence el ${isoAFecha(plan.fechaVencimiento)}.`,
          fecha: plan.fechaVencimiento,
          urgencia: diffDays <= 2 ? 'alta' : diffDays <= 5 ? 'media' : 'baja',
          venceHoy,
          monto: plan.importeCuota,
          moneda: plan.moneda,
        });
      }
    });

    // 4. Presupuestos (mes calendario actual)
    presupuestos.forEach((p) => {
      if (!p.excedido && p.porcentaje < 80) return;

      const nombre = normalizarCodigoRubro(p.rubro.nombre);
      const id = `PRESUPUESTO-${p.rubro.id}-${mesActualStr}`;

      if (p.excedido) {
        list.push({
          id,
          tipo: 'presupuesto',
          entityId: p.rubro.id,
          titulo: `Presupuesto excedido: ${nombre}`,
          mensaje: `Superaste el tope de ${nombre} este mes (${p.porcentaje.toFixed(0)}%).`,
          fecha: hoyIso,
          urgencia: 'alta',
          venceHoy: false,
          monto: p.gastado,
          moneda: 'ARS',
        });
      } else {
        list.push({
          id,
          tipo: 'presupuesto',
          entityId: p.rubro.id,
          titulo: `Presupuesto al ${p.porcentaje.toFixed(0)}%: ${nombre}`,
          mensaje: `Te acercás al tope mensual de ${nombre}.`,
          fecha: hoyIso,
          urgencia: 'media',
          venceHoy: false,
          monto: p.gastado,
          moneda: 'ARS',
        });
      }
    });

    return list.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [tarjetas, prestamos, planesAhorro, gastosDiarios, consumosTarjetas, presupuestos]);

  return {
    notifications,
    count: notifications.length,
    // Only items ≤ 2 days away drive the bell badge
    bellCount: notifications.filter(n => n.urgencia === 'alta').length,
  };
};
