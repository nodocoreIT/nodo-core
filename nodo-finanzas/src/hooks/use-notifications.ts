import { useMemo } from 'react';
import { useFinanzas } from '@/hooks/use-finanzas';
import { calcularFechasTarjeta } from '@/utils/tarjeta-fechas';
import type { Tarjeta, Prestamo, PlanAhorro } from '@/types';

export interface Notification {
  id: string;
  tipo: 'tarjeta' | 'prestamo' | 'plan';
  titulo: string;
  mensaje: string;
  fecha: string;
  urgencia: 'baja' | 'media' | 'alta';
}

export const useNotifications = () => {
  const { tarjetas, prestamos, planesAhorro, gastosDiarios } = useFinanzas();

  const notifications = useMemo(() => {
    const list: Notification[] = [];
    const hoy = new Date();
    const mesActualIdx = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    const mesActualStr = `${anioActual}-${String(mesActualIdx + 1).padStart(2, '0')}`;

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
      if (!tarjeta.activa || !tarjeta.diaVencimiento || !tarjeta.diaCierre) return;

      const fechas = calcularFechasTarjeta({
        closingDay: tarjeta.diaCierre,
        dueOffsetDays: (tarjeta.diaVencimiento - tarjeta.diaCierre + 30) % 30 || 14,
      }, hoy);

      const vtoStr = fechas.currentDueDate;
      const id = `TARJETA-${tarjeta.id}-${vtoStr.substring(0, 7)}`;

      if (estaPagado('tarjeta', tarjeta.id)) return;

      const fechaVencimiento = new Date(vtoStr + 'T00:00:00');
      const diff = fechaVencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (diffDays >= -5 && diffDays <= 10) {
        list.push({
          id,
          tipo: 'tarjeta',
          titulo: `Vencimiento ${tarjeta.nombre}`,
          mensaje: `El pago de tu tarjeta ${tarjeta.nombre} vence el ${vtoStr}.`,
          fecha: vtoStr,
          urgencia: diffDays <= 2 ? 'alta' : 'media',
        });
      }
    });

    // 2. Préstamos
    prestamos.forEach((prestamo: Prestamo) => {
      if (!prestamo.activo || !prestamo.fechaVencimiento || prestamo.cuotaAbonada || prestamo.pagado) return;

      const id = `PRESTAMO-${prestamo.id}-${mesActualStr}`;
      if (estaPagado('prestamo', prestamo.id)) return;

      const fechaVencimiento = new Date(prestamo.fechaVencimiento + 'T00:00:00');
      const diff = fechaVencimiento.getTime() - hoy.getTime();
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (diffDays <= 10) {
        list.push({
          id,
          tipo: 'prestamo',
          titulo: `Cuota de ${prestamo.concepto}`,
          mensaje: `La cuota de "${prestamo.concepto}" vence el ${prestamo.fechaVencimiento}.`,
          fecha: prestamo.fechaVencimiento,
          urgencia: diffDays <= 2 ? 'alta' : 'media',
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

      if (diffDays <= 10) {
        list.push({
          id,
          tipo: 'plan',
          titulo: `Cuota de Plan: ${plan.detalle}`,
          mensaje: `La cuota del plan "${plan.detalle}" vence el ${plan.fechaVencimiento}.`,
          fecha: plan.fechaVencimiento,
          urgencia: diffDays <= 2 ? 'alta' : 'media',
        });
      }
    });

    return list.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [tarjetas, prestamos, planesAhorro, gastosDiarios]);

  return {
    notifications,
    count: notifications.length
  };
};
