import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, HandCoins, CheckCircle, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useDolar } from '@/hooks/use-dolar';
import { useNotifications } from '@/hooks/use-notifications';
import { formatearMoneda, formatearFecha, esFechaDelMesActual } from '@/utils/formatters';

export function DashboardPage() {
  const finanzas = useFinanzas();
  const dolar = useDolar();
  const { notifications } = useNotifications();

  if (finanzas.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-10 w-10" />
          <p className="text-sm text-slate2">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  const hoy = new Date();
  const mesActualIdx = hoy.getMonth();
  const anioActual = hoy.getFullYear();
  const mesActualStr = `${anioActual}-${String(mesActualIdx + 1).padStart(2, '0')}`;

  // Total ARS (cuentas activas en ARS)
  const totalARS = finanzas.cuentas
    .filter((c) => c.activa && c.moneda === 'ARS')
    .reduce((s, c) => s + c.saldoActual, 0);

  // Total USD
  const totalUSD = finanzas.cuentas
    .filter((c) => c.activa && c.moneda === 'USD')
    .reduce((s, c) => s + c.saldoActual, 0);

  // Gastos del mes actual
  const gastosMes = finanzas.gastosDiarios
    .filter((g) => g.fecha.startsWith(mesActualStr) && !g.esSilencioso)
    .reduce((s, g) => s + g.monto, 0);

  // Obligaciones pendientes (gastos fijos activos no pagados este mes)
  const obligacionesPendientes = finanzas.gastosFijos.filter((gf) => {
    if (!gf.activo) return false;
    const estaPagado = finanzas.gastosDiarios.some(
      (g) => g.gastoFijoId === gf.id && esFechaDelMesActual(g.fecha)
    );
    return !estaPagado;
  }).length;

  // Últimos 5 gastos diarios
  const ultimosGastos = [...finanzas.gastosDiarios]
    .filter((g) => !g.esSilencioso)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5);

  const fechaHoy = hoy.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const urgenciaColor = {
    alta: 'border-l-red-500 bg-red-50/30',
    media: 'border-l-amber-500 bg-amber-50/20',
    baja: 'border-l-brand bg-mist/20',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bienvenido</h1>
          <p className="text-sm text-slate2 capitalize">{fechaHoy}</p>
        </div>
        <div className="flex items-center gap-3">
          {dolar.cotizacion && (
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full">
              USD {dolar.tipoDolarSeleccionado.toUpperCase()} · Venta ${dolar.cotizacion.venta.toFixed(0)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            loading={dolar.loading}
            onClick={() => dolar.obtenerCotizacion()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar dólar
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-brand/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total ARS</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(totalARS)}</p>
        </Card>

        <Card className="border-brand/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total USD</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(totalUSD, 'USD')}</p>
          {dolar.cotizacion && totalUSD > 0 && (
            <p className="text-[10px] text-slate2 mt-0.5">≈ {formatearMoneda(dolar.convertirUSDaARS(totalUSD))}</p>
          )}
        </Card>

        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Gastos del mes</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(gastosMes)}</p>
          <p className="text-[10px] text-slate2 mt-0.5">{mesActualStr}</p>
        </Card>

        <Card className={obligacionesPendientes > 0 ? 'border-amber-300 bg-amber-50/40' : ''}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${obligacionesPendientes > 0 ? 'bg-amber-100' : 'bg-mist'}`}>
              <HandCoins className={`h-4 w-4 ${obligacionesPendientes > 0 ? 'text-amber-600' : 'text-brand'}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Obligaciones</p>
              <p className="text-xl font-black text-ink">{obligacionesPendientes}</p>
              <p className="text-[10px] text-slate2">pendientes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent gastos */}
        <Card title="Últimos Gastos">
          {ultimosGastos.length === 0 ? (
            <p className="text-sm text-slate2 text-center py-6">Sin gastos registrados</p>
          ) : (
            <div className="space-y-2">
              {ultimosGastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-mist last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{g.descripcion}</p>
                    <p className="text-[10px] text-slate2">{formatearFecha(g.fecha)}</p>
                  </div>
                  <p className="text-sm font-bold text-ink ml-3">{formatearMoneda(g.monto)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming obligations */}
        <Card title="Próximos Vencimientos">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <CheckCircle className="h-8 w-8 text-brand opacity-60" />
              <p className="text-sm font-semibold text-ink">Todo al día</p>
              <p className="text-xs text-slate2">Sin vencimientos próximos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between p-3 rounded-lg border-l-4 ${urgenciaColor[n.urgencia]}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Bell className="h-3.5 w-3.5 text-slate2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{n.titulo}</p>
                      <p className="text-xs text-slate2">{formatearFecha(n.fecha)}</p>
                    </div>
                  </div>
                  {n.urgencia === 'alta' && (
                    <span className="ml-2 text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      Urgente
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Dolar rates */}
      {dolar.cotizacion && (
        <Card title="Cotización del Dólar">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="p-3 rounded-lg bg-mist/50 border border-mist">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">
                {dolar.cotizacion.tipo.toUpperCase()}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <p className="text-[9px] text-slate2">Compra</p>
                  <p className="text-base font-black text-ink">${dolar.cotizacion.compra.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate2">Venta</p>
                  <p className="text-base font-black text-brand">${dolar.cotizacion.venta.toFixed(0)}</p>
                </div>
              </div>
              <p className="text-[9px] text-slate2 mt-1.5">
                {formatearFecha(dolar.cotizacion.fechaActualizacion)}
              </p>
            </div>
          </div>
          {dolar.error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {dolar.error}
            </div>
          )}
        </Card>
      )}

      {/* Net balance card */}
      {(totalARS + (dolar.cotizacion ? dolar.convertirUSDaARS(totalUSD) : 0) - gastosMes) !== 0 && (
        <Card className={`${(totalARS - gastosMes) >= 0 ? 'bg-brand/5 border-brand/30' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${(totalARS - gastosMes) >= 0 ? 'bg-brand/10' : 'bg-red-100'}`}>
              {(totalARS - gastosMes) >= 0
                ? <TrendingUp className="h-5 w-5 text-brand" />
                : <TrendingDown className="h-5 w-5 text-red-600" />
              }
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Balance estimado del mes</p>
              <p className={`text-xl font-black ${(totalARS - gastosMes) >= 0 ? 'text-brand' : 'text-red-600'}`}>
                {formatearMoneda(totalARS - gastosMes)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
