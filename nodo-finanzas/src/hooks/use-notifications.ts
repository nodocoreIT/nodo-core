import { useMemo } from 'react';
import { useFinanzas } from '@/hooks/use-finanzas';
import { usePresupuestos } from '@/hooks/use-presupuestos';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import { calcularFechasTarjeta } from '@/utils/tarjeta-fechas';
import {
  diasHastaFecha,
  vencimientoCuotaMesEnCurso,
} from '@/utils/vencimientos';
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

function urgenciaPorDias(diffDays: number): 'baja' | 'media' | 'alta' {
  if (diffDays <= 2) return 'alta';
  if (diffDays <= 5) return 'media';
  return 'baja';
}

function resolveTarjetaDueDate(tarjeta: Tarjeta, hoy: Date): string | null {
  if (tarjeta.diaCierre && tarjeta.diaVencimiento) {
    const offset =
      ((tarjeta.diaVencimiento - tarjeta.diaCierre + 30) % 30) || 14;
    const fechas = calcularFechasTarjeta(
      { closingDay: tarjeta.diaCierre, dueOffsetDays: offset },
      hoy,
    );
    const prevMes = fechas.previousDueDate.slice(0, 7);
    const currMes = fechas.currentDueDate.slice(0, 7);

    // Si el ciclo anterior sigue sin pagar, mostrar ese vencimiento (vencido).
    if (
      tarjeta.ultimoPagoMes !== prevMes &&
      diasHastaFecha(fechas.previousDueDate, hoy) < 0
    ) {
      return fechas.previousDueDate;
    }

    // Si ya pagó el ciclo actual, no hay aviso.
    if (tarjeta.ultimoPagoMes === currMes) return null;

    return fechas.currentDueDate;
  }

  // Fallback: proyectar el día de fechaVencimiento al mes en curso.
  return vencimientoCuotaMesEnCurso(
    { fechaVencimiento: tarjeta.fechaVencimiento },
    hoy,
  );
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

    const estaPagado = (tipo: 'tarjeta' | 'prestamo' | 'plan', id: string) => {
      return gastosDiarios.some((g) => {
        const fechaGasto = new Date(g.fecha + 'T12:00:00');
        const mismoMes =
          fechaGasto.getMonth() === mesActualIdx &&
          fechaGasto.getFullYear() === anioActual;
        if (!mismoMes) return false;
        if (tipo === 'tarjeta') return g.pagoTarjetaId === id;
        if (tipo === 'prestamo') return g.prestamoId === id;
        if (tipo === 'plan') return g.planId === id;
        return false;
      });
    };

    // 1. Tarjetas — fecha del ciclo actual (o anterior impago), no fecha sticky vieja
    tarjetas.forEach((tarjeta: Tarjeta) => {
      if (!tarjeta.activa) return;
      if (estaPagado('tarjeta', tarjeta.id) || tarjeta.ultimoPagoMes === mesActualStr) return;

      const vtoStr = resolveTarjetaDueDate(tarjeta, hoy);
      if (!vtoStr) return;

      const mesVto = vtoStr.slice(0, 7);
      if (tarjeta.ultimoPagoMes === mesVto) return;

      const diffDays = diasHastaFecha(vtoStr, hoy);
      // Solo el ciclo en curso / recién vencido (evita basura de hace meses)
      if (diffDays < -35 || diffDays > 31) return;

      const venceHoy = diffDays === 0;
      const montoPeriodo = consumosTarjetas
        .filter((c) => c.tarjetaId === tarjeta.id && c.fecha.startsWith(mesVto))
        .reduce((sum, c) => sum + (c.importeARS ?? 0), 0);

      list.push({
        id: `TARJETA-${tarjeta.id}-${mesVto}`,
        tipo: 'tarjeta',
        entityId: tarjeta.id,
        titulo: `Vencimiento ${tarjeta.nombre}`,
        mensaje:
          diffDays < 0
            ? `El pago de tu tarjeta ${tarjeta.nombre} está vencido (${isoAFecha(vtoStr)}).`
            : venceHoy
              ? `El pago de tu tarjeta ${tarjeta.nombre} vence hoy.`
              : `El pago de tu tarjeta ${tarjeta.nombre} vence el ${isoAFecha(vtoStr)}.`,
        fecha: vtoStr,
        urgencia: urgenciaPorDias(diffDays),
        venceHoy,
        monto: montoPeriodo > 0 ? montoPeriodo : undefined,
        moneda: 'ARS',
      });
    });

    // 2. Préstamos — proyectar al mes en curso
    prestamos.forEach((prestamo: Prestamo) => {
      if (
        !prestamo.activo ||
        prestamo.pagado ||
        prestamo.noCobrarCuota ||
        prestamo.ultimoPagoMes === mesActualStr
      ) {
        return;
      }

      const vtoStr = vencimientoCuotaMesEnCurso(
        { diaPago: prestamo.diaPago, fechaVencimiento: prestamo.fechaVencimiento },
        hoy,
      );
      if (!vtoStr) return;

      const id = `PRESTAMO-${prestamo.id}-${mesActualStr}`;
      if (estaPagado('prestamo', prestamo.id)) return;

      const diffDays = diasHastaFecha(vtoStr, hoy);
      if (diffDays < -35 || diffDays > 31) return;

      const venceHoy = diffDays === 0;
      list.push({
        id,
        tipo: 'prestamo',
        entityId: prestamo.id,
        titulo: `Cuota de ${prestamo.concepto}`,
        mensaje:
          diffDays < 0
            ? `La cuota de "${prestamo.concepto}" está vencida (${isoAFecha(vtoStr)}).`
            : venceHoy
              ? `La cuota de "${prestamo.concepto}" vence hoy.`
              : `La cuota de "${prestamo.concepto}" vence el ${isoAFecha(vtoStr)}.`,
        fecha: vtoStr,
        urgencia: urgenciaPorDias(diffDays),
        venceHoy,
        monto: prestamo.importeCuota,
        moneda: prestamo.moneda,
      });
    });

    // 3. Planes de Ahorro — proyectar al mes en curso
    planesAhorro.forEach((plan: PlanAhorro) => {
      if (!plan.activa) return;

      const vtoStr = vencimientoCuotaMesEnCurso(
        { fechaVencimiento: plan.fechaVencimiento },
        hoy,
      );
      if (!vtoStr) return;

      const id = `PLAN_AHORRO-${plan.id}-${mesActualStr}`;
      if (estaPagado('plan', plan.id)) return;
      // Si el último pago del plan quedó marcado en otro campo, el gasto del mes ya filtra

      const diffDays = diasHastaFecha(vtoStr, hoy);
      if (diffDays < -35 || diffDays > 31) return;

      const venceHoy = diffDays === 0;
      list.push({
        id,
        tipo: 'plan',
        entityId: plan.id,
        titulo: `Cuota de Plan: ${plan.detalle}`,
        mensaje:
          diffDays < 0
            ? `La cuota del plan "${plan.detalle}" está vencida (${isoAFecha(vtoStr)}).`
            : venceHoy
              ? `La cuota del plan "${plan.detalle}" vence hoy.`
              : `La cuota del plan "${plan.detalle}" vence el ${isoAFecha(vtoStr)}.`,
        fecha: vtoStr,
        urgencia: urgenciaPorDias(diffDays),
        venceHoy,
        monto: plan.importeCuota,
        moneda: plan.moneda,
      });
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
    // Only items ≤ 2 days away (or overdue) drive the bell badge
    bellCount: notifications.filter((n) => n.urgencia === 'alta').length,
  };
};
