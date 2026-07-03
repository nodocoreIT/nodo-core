import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, CheckCircle, Bell, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useNotifications } from '@/hooks/use-notifications';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const finanzas = useFinanzas();

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

  // Gastos del día
  const todayStr = hoy.toISOString().split('T')[0];
  const gastosDelDia = finanzas.gastosDiarios
    .filter((g) => g.fecha === todayStr && !g.esSilencioso)
    .reduce((s, g) => s + g.monto, 0);

  // Gastos del mes actual
  const gastosMes = finanzas.gastosDiarios
    .filter((g) => g.fecha.startsWith(mesActualStr) && !g.esSilencioso)
    .reduce((s, g) => s + g.monto, 0);

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bienvenido</h1>
          <p className="text-sm text-slate2 capitalize">{fechaHoy}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/gastos-diarios")}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 sm:hidden"
        >
          <Plus className="h-4 w-4" />
          Nuevo gasto
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-brand/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Dinero disponible en cuentas</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-ink mt-1 leading-tight">{formatearMoneda(totalARS)}</p>
        </Card>

        <Card className="border-orange-200 bg-orange-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">Gastos del Día</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-orange-600 mt-1 leading-tight">{formatearMoneda(gastosDelDia)}</p>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Gastos del Mes</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-red-600 mt-1 leading-tight">{formatearMoneda(gastosMes)}</p>
          <p className="text-[10px] text-red-300 mt-0.5">{mesActualStr}</p>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Saldo</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-emerald-700 mt-1 leading-tight">
            {formatearMoneda(totalARS - gastosMes)}
          </p>
          <p className="text-[10px] text-emerald-500 mt-0.5">disponible este mes</p>
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
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.tipo === 'tarjeta') {
                      navigate(`/admin/tarjetas/${n.entityId}`);
                    } else if (n.tipo === 'prestamo') {
                      navigate('/admin/prestamos', { state: { openId: n.entityId } });
                    } else {
                      navigate('/admin/planes-ahorro', { state: { openId: n.entityId } });
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-l-4 gap-2 text-left transition-opacity hover:opacity-80 cursor-pointer ${urgenciaColor[n.urgencia]}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Bell className="h-3.5 w-3.5 text-slate2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{n.titulo}</p>
                      <p className="text-xs text-slate2">{formatearFecha(n.fecha)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {n.monto != null && (
                      <span className="text-sm font-bold text-ink">
                        {formatearMoneda(n.monto, n.moneda ?? 'ARS')}
                      </span>
                    )}
                    {n.urgencia === 'alta' && (
                      <span className="text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                        Urgente
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Net balance card */}
      {(totalARS - gastosMes) !== 0 && (
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
