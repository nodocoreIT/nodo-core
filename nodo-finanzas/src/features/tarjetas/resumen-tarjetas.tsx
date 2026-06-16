import { TrendingUp, DollarSign, CreditCard, BarChart3 } from 'lucide-react';
import type { RubroConsumo, CotizacionDolar } from '@/types';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';

interface ResumenTarjeta {
  tarjeta: { id: string; nombre: string };
  totalARS: number;
  totalUSD: number;
  totalEnARS: number;
  restanteARS?: number;
  restanteUSD?: number;
  consumosPorRubro: Record<RubroConsumo, number>;
  cantidadTransacciones: number;
  porcentajeUsado: number;
}

interface ResumenTarjetasProps {
  resumenesDelMes: ResumenTarjeta[];
  totalGeneralMes: number;
  filtroMes: string;
  cotizacion: CotizacionDolar | null;
}

function formatearMes(fechaMes: string): string {
  const [anio, mes] = fechaMes.split('-');
  const fecha = new Date(parseInt(anio), parseInt(mes) - 1);
  return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function ResumenTarjetas({
  resumenesDelMes,
  totalGeneralMes,
  filtroMes,
  cotizacion,
}: ResumenTarjetasProps) {
  const totalTransacciones = resumenesDelMes.reduce(
    (acc, r) => acc + r.cantidadTransacciones,
    0
  );
  const totalUSDDelMes = resumenesDelMes.reduce((acc, r) => {
    const usd = r.restanteUSD !== undefined ? r.restanteUSD : r.totalUSD;
    return acc + usd;
  }, 0);

  const gastosPorRubro = resumenesDelMes.reduce(
    (acc, r) => {
      Object.entries(r.consumosPorRubro).forEach(([rubro, monto]) => {
        acc[rubro as RubroConsumo] = (acc[rubro as RubroConsumo] || 0) + monto;
      });
      return acc;
    },
    {} as Record<RubroConsumo, number>
  );

  const rubrosOrdenados = Object.entries(gastosPorRubro)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate2">
              Total {formatearMes(filtroMes)}
            </p>
            <p className="text-2xl font-bold text-ink">
              ${totalGeneralMes.toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            {totalUSDDelMes > 0 && (
              <p className="text-sm text-slate2 mt-1">
                +USD {totalUSDDelMes.toLocaleString('en-US')}
              </p>
            )}
          </div>
          <div className="bg-brand/10 p-3 rounded-full">
            <DollarSign className="w-6 h-6 text-brand" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate2">Transacciones</p>
            <p className="text-2xl font-bold text-ink">{totalTransacciones}</p>
            <p className="text-sm text-slate2 mt-1">
              {resumenesDelMes.length} tarjeta
              {resumenesDelMes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate2">Promedio por gasto</p>
            <p className="text-2xl font-bold text-ink">
              $
              {totalTransacciones > 0
                ? (totalGeneralMes / totalTransacciones).toLocaleString('es-AR')
                : '0'}
            </p>
            <p className="text-sm text-slate2 mt-1">
              {cotizacion && `Dólar: $${cotizacion.venta}`}
            </p>
          </div>
          <div className="bg-purple-100 p-3 rounded-full">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate2">Mayor gasto</p>
            <p className="text-lg font-bold text-ink">
              {rubrosOrdenados.length > 0
                ? normalizarCodigoRubro(rubrosOrdenados[0][0])
                : 'Sin datos'}
            </p>
            <p className="text-sm text-slate2 mt-1">
              {rubrosOrdenados.length > 0 &&
                `$${rubrosOrdenados[0][1].toLocaleString('es-AR')}`}
            </p>
          </div>
          <div className="bg-orange-100 p-3 rounded-full">
            <BarChart3 className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>

      {rubrosOrdenados.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-mist p-5 md:col-span-2 lg:col-span-4">
          <h4 className="font-semibold text-ink mb-4">
            Gastos por Categoría — {formatearMes(filtroMes)}
          </h4>
          <div className="space-y-3">
            {rubrosOrdenados.map(([rubro, monto]) => {
              const porcentaje =
                totalGeneralMes > 0 ? (monto / totalGeneralMes) * 100 : 0;
              return (
                <div key={rubro} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-sm font-medium text-slate2 w-36">
                      {normalizarCodigoRubro(rubro)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-mist">
                      <div
                        className="h-2 rounded-full bg-brand"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-ink">
                      ${monto.toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-slate2">{porcentaje.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
