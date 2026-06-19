import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useDolar } from '@/hooks/use-dolar';
import { useRubros } from '@/hooks/use-rubros';
import { formatearMoneda } from '@/utils/formatters';
import { getRubroColor } from '@/utils/rubro-colors';
import type { Rubro } from '@/types';

interface GastoRubroDetalle {
  descripcion: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  montoArs: number;
}

interface RubroResumenData {
  total: number;
  count: number;
  items: GastoRubroDetalle[];
}

interface RubroDetalleModal {
  rubroId: string;
  rubro?: Rubro;
  data: RubroResumenData;
  color: ReturnType<typeof getRubroColor>;
}

export function ResumenCategorias() {
  const finanzas = useFinanzas();
  const dolar = useDolar();
  const { rubros } = useRubros();
  const [rubroDetalle, setRubroDetalle] = useState<RubroDetalleModal | null>(null);

  useEffect(() => {
    if (!rubroDetalle) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [rubroDetalle]);

  const resumenPorRubro = () => {
    const gastosActivos = finanzas.gastosFijos.filter((g) => g.activo);
    const resumen: Record<string, RubroResumenData> = {};

    gastosActivos.forEach((gasto) => {
      const rubroId = gasto.rubroId || 'sin-rubro';
      if (!resumen[rubroId]) {
        resumen[rubroId] = { total: 0, count: 0, items: [] };
      }
      const montoArs =
        gasto.moneda === 'USD' && dolar.cotizacion
          ? dolar.convertirUSDaARS(gasto.monto)
          : gasto.monto;
      const descripcion = gasto.etiqueta
        ? `${gasto.descripcion} (${gasto.etiqueta})`
        : gasto.descripcion;

      resumen[rubroId].total += montoArs;
      resumen[rubroId].count += 1;
      resumen[rubroId].items.push({
        descripcion,
        monto: gasto.monto,
        moneda: gasto.moneda,
        montoArs,
      });
    });

    return Object.entries(resumen)
      .filter(([, d]) => d.count > 0)
      .sort(([, a], [, b]) => b.total - a.total);
  };

  const resumen = resumenPorRubro();

  if (resumen.length === 0) return null;

  const itemsDetalle = rubroDetalle
    ? [...rubroDetalle.data.items].sort((a, b) => b.montoArs - a.montoArs)
    : [];

  return (
    <>
      <Card title="Gastos por Rubro" collapsible>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumen.map(([rubroId, data]) => {
            const rubro = rubros.find((r) => r.id === rubroId);
            const color = getRubroColor(rubroId);
            return (
              <button
                key={rubroId}
                type="button"
                onClick={() => setRubroDetalle({ rubroId, rubro, data, color })}
                className={`p-4 rounded-xl border text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${color.bg} ${color.text}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <RubroDisplay rubro={rubro} fallback="Sin rubro" />
                  <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">
                    {data.count} {data.count === 1 ? 'gasto' : 'gastos'}
                  </span>
                </div>
                <p className="text-xl font-black mb-2">{formatearMoneda(data.total)}</p>
                <div className="space-y-0.5">
                  {data.items.slice(0, 3).map((item, idx) => (
                    <p key={idx} className="text-xs opacity-75 truncate">
                      • {item.descripcion}
                    </p>
                  ))}
                  {data.items.length > 3 && (
                    <p className="text-xs opacity-75">+ {data.items.length - 3} más</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {rubroDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setRubroDetalle(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de gastos por rubro"
            className={`w-full max-w-md rounded-2xl border shadow-xl overflow-hidden ${rubroDetalle.color.bg} ${rubroDetalle.color.text}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-black/10">
              <div>
                <RubroDisplay
                  rubro={rubroDetalle.rubro}
                  fallback="Sin rubro"
                  showDescription={false}
                />
                <p className="text-2xl font-black mt-2">
                  {formatearMoneda(rubroDetalle.data.total)}
                </p>
                <p className="text-xs opacity-70 mt-1">
                  {rubroDetalle.data.count}{' '}
                  {rubroDetalle.data.count === 1 ? 'gasto' : 'gastos'} en total
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRubroDetalle(null)}
                className="p-1.5 rounded-lg bg-white/40 hover:bg-white/60 transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="max-h-[min(60vh,420px)] overflow-y-auto divide-y divide-black/10">
              {itemsDetalle.map((item, idx) => (
                <li
                  key={`${item.descripcion}-${idx}`}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <p className="text-sm font-medium leading-snug min-w-0">{item.descripcion}</p>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold whitespace-nowrap">
                      {formatearMoneda(item.monto, item.moneda)}
                    </p>
                    {item.moneda === 'USD' && dolar.cotizacion && (
                      <p className="text-[11px] opacity-70 whitespace-nowrap">
                        ≈ {formatearMoneda(item.montoArs)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
