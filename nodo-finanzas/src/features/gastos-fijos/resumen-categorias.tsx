import { Card } from '@/components/ui/card';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useDolar } from '@/hooks/use-dolar';
import { useRubros } from '@/hooks/use-rubros';
import { formatearMoneda } from '@/utils/formatters';
import { getRubroColor } from '@/utils/rubro-colors';

export function ResumenCategorias() {
  const finanzas = useFinanzas();
  const dolar = useDolar();
  const { rubros } = useRubros();

  const resumenPorRubro = () => {
    const gastosActivos = finanzas.gastosFijos.filter((g) => g.activo);
    const resumen: Record<string, { total: number; count: number; items: string[] }> = {};

    gastosActivos.forEach((gasto) => {
      const rubroId = gasto.rubroId || 'sin-rubro';
      if (!resumen[rubroId]) {
        resumen[rubroId] = { total: 0, count: 0, items: [] };
      }
      const monto =
        gasto.moneda === 'USD' && dolar.cotizacion
          ? dolar.convertirUSDaARS(gasto.monto)
          : gasto.monto;
      resumen[rubroId].total += monto;
      resumen[rubroId].count += 1;
      const desc = gasto.etiqueta ? `${gasto.descripcion} (${gasto.etiqueta})` : gasto.descripcion;
      resumen[rubroId].items.push(desc);
    });

    return Object.entries(resumen)
      .filter(([, d]) => d.count > 0)
      .sort(([, a], [, b]) => b.total - a.total);
  };

  const resumen = resumenPorRubro();

  if (resumen.length === 0) return null;

  return (
    <Card title="Gastos por Rubro" collapsible>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resumen.map(([rubroId, data]) => {
          const rubro = rubros.find((r) => r.id === rubroId);
          const color = getRubroColor(rubroId);
          return (
            <div
              key={rubroId}
              className={`p-4 rounded-xl border ${color.bg} ${color.text}`}
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
                  <p key={idx} className="text-xs opacity-75 truncate">• {item}</p>
                ))}
                {data.items.length > 3 && (
                  <p className="text-xs opacity-75">+ {data.items.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
