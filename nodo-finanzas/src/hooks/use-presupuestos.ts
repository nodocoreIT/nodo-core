import { useMemo } from 'react';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { useDolar } from '@/hooks/use-dolar';
import type { Rubro } from '@/types';

export interface PresupuestoConGasto {
  rubro: Rubro;
  presupuesto: number;
  gastado: number;
  porcentaje: number;
  excedido: boolean;
}

/**
 * Presupuesto mensual por rubro vs. lo efectivamente gastado este mes
 * calendario (gastos diarios con fecha en el mes + gastos fijos activos no
 * excluidos del resumen, que se consideran vigentes todos los meses).
 * Recurrente por diseño: no hay que "resetear" nada — cambia el mes actual
 * y el cálculo solo. */
export function usePresupuestos(): PresupuestoConGasto[] {
  const { gastosDiarios, gastosFijos } = useFinanzas();
  const { rubrosActivos } = useRubros();
  const dolar = useDolar();

  return useMemo(() => {
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    const conPresupuesto = rubrosActivos.filter(
      (r) => r.presupuestoMensual != null && r.presupuestoMensual > 0,
    );

    return conPresupuesto.map((rubro) => {
      const gastadoDiarios = gastosDiarios
        .filter((g) => {
          if ((g.rubroId ?? g.rubro) !== rubro.id) return false;
          const fecha = new Date(g.fecha + 'T12:00:00');
          return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
        })
        .reduce((sum, g) => sum + g.monto, 0);

      const gastadoFijos = gastosFijos
        .filter((g) => g.activo && !g.excluirDelResumen && g.rubroId === rubro.id)
        .reduce((sum, g) => {
          const montoArs =
            g.moneda === 'USD' && dolar.cotizacion ? dolar.convertirUSDaARS(g.monto) : g.monto;
          return sum + montoArs;
        }, 0);

      const gastado = gastadoDiarios + gastadoFijos;
      const presupuesto = rubro.presupuestoMensual ?? 0;
      const porcentaje = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;

      return {
        rubro,
        presupuesto,
        gastado,
        porcentaje,
        excedido: gastado > presupuesto,
      };
    }).sort((a, b) => b.porcentaje - a.porcentaje);
  }, [gastosDiarios, gastosFijos, rubrosActivos, dolar]);
}
