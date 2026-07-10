import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Bell, Plus, Wallet, ShoppingCart, CalendarRange, PiggyBank, Landmark, CreditCard, Settings2, X, ClipboardList, Coins, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useNotifications } from '@/hooks/use-notifications';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import { calcularFechasTarjeta } from '@/utils/tarjeta-fechas';

const CARD_LABELS = {
  saldo: 'Saldo del Mes',
  dineroCuentas: 'Dinero disponible',
  gastosDia: 'Gastos del Día',
  gastosMes: 'Gastos del Mes',
  gastosFijosPendientes: 'Gastos Fijos Pendientes',
  totalPrestamos: 'Total Préstamos',
  totalTarjetas: 'Total Tarjetas',
  totalPlanesAhorro: 'Planes de Ahorro',
} as const;

type CardKey = keyof typeof CARD_LABELS;

const ALL_VISIBLE: Record<CardKey, boolean> = {
  saldo: true,
  dineroCuentas: true,
  gastosDia: false,
  gastosMes: false,
  gastosFijosPendientes: true,
  totalPrestamos: true,
  totalTarjetas: true,
  totalPlanesAhorro: true,
};

const STORAGE_KEY = 'dashboard-cards-v3';

function loadVisibility(): Record<CardKey, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...ALL_VISIBLE, ...JSON.parse(stored) };
  } catch {}
  return ALL_VISIBLE;
}

function saveVisibility(v: Record<CardKey, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {}
}

export function DashboardPage() {
  const navigate = useNavigate();
  const finanzas = useFinanzas();
  const { tarjetas, consumosTarjetas } = finanzas;
  const { notifications } = useNotifications();

  const [mostrarPersonalizar, setMostrarPersonalizar] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [visibility, setVisibility] = useState<Record<CardKey, boolean>>(loadVisibility);

  const toggleCard = (key: CardKey) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibility(next);
      return next;
    });
  };

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
  const mesLabel = (() => {
    const s = new Date(anioActual, mesActualIdx, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const totalARS = finanzas.cuentas
    .filter((c) => c.activa && c.moneda === 'ARS')
    .reduce((s, c) => s + c.saldoActual, 0);

  const todayStr = hoy.toISOString().split('T')[0];
  const gastosDelDia = finanzas.gastosDiarios
    .filter((g) => g.fecha === todayStr && !g.esSilencioso && !g.pagoTarjetaId)
    .reduce((s, g) => s + g.monto, 0);

  const gastosMes = finanzas.gastosDiarios
    .filter((g) => g.fecha.startsWith(mesActualStr) && !g.esSilencioso && !g.pagoTarjetaId)
    .reduce((s, g) => s + g.monto, 0);

  // Fixed expenses not yet paid this month (have no gastosDiario with gastoFijoId in current month)
  const totalGastosFijosPendientes = finanzas.gastosFijos
    .filter((gf) => {
      if (!gf.activo || gf.moneda !== 'ARS' || gf.excluirDelResumen) return false;
      return !finanzas.gastosDiarios.some(
        (gd) => gd.gastoFijoId === gf.id && gd.fecha.startsWith(mesActualStr),
      );
    })
    .reduce((s, gf) => s + gf.monto, 0);

  // Sum of monthly installments for loans pending payment this month
  const totalPrestamos = finanzas.prestamos
    .filter(
      (p) =>
        p.activo &&
        !p.pagado &&
        !p.cuotaAbonada &&
        p.ultimoPagoMes !== mesActualStr &&
        p.moneda === 'ARS',
    )
    .reduce((s, p) => s + (p.importeCuota ?? 0), 0);

  const totalTarjetas = tarjetas
    .filter((t) => t.activa && t.diaCierre && t.diaVencimiento)
    .reduce((sum, tarjeta) => {
      const fechas = calcularFechasTarjeta(
        {
          closingDay: tarjeta.diaCierre!,
          dueOffsetDays: (tarjeta.diaVencimiento! - tarjeta.diaCierre! + 30) % 30 || 14,
        },
        hoy,
      );
      const periodoMonto = consumosTarjetas
        .filter(
          (c) =>
            c.tarjetaId === tarjeta.id &&
            c.fecha > fechas.previousClosingDate &&
            c.fecha <= fechas.currentClosingDate,
        )
        .reduce((s, c) => s + (c.importeARS ?? 0), 0);

      // Deduct any payment registered this month for this card
      const gastoPago = finanzas.gastosDiarios.find(
        (g) => g.pagoTarjetaId === tarjeta.id && g.fecha.startsWith(mesActualStr),
      );
      if (!gastoPago) return sum + periodoMonto;
      if (!gastoPago.pagoParcial) return sum; // fully paid — card contributes 0
      return sum + Math.max(0, periodoMonto - gastoPago.monto); // partial — deduct paid amount
    }, 0);

  // Account balances for quick-view cards
  const cuentaMercadoPago = finanzas.cuentas
    .filter((c) => c.nombre.toLowerCase().includes('mercado'))
    .sort((a, b) => b.saldoActual - a.saldoActual)[0];
  const cuentasSantander = finanzas.cuentas.filter(
    (c) => c.nombre.toLowerCase().includes('santander'),
  );

  // Sum of savings plan installments pending this month (active plans with cuotas remaining, not yet paid this month)
  const totalPlanesAhorro = finanzas.planesAhorro
    .filter((p) => {
      if (!p.activa || p.cuotasPagas >= p.cuotasTotales) return false;
      return !finanzas.gastosDiarios.some(
        (g) => g.planId === p.id && g.fecha.startsWith(mesActualStr),
      );
    })
    .reduce((s, p) => s + (p.moneda === 'ARS' ? p.importeCuota : 0), 0);

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

  const urgenciaStyle = {
    alta:  { card: 'bg-red-500 hover:bg-red-600',       icon: 'text-white/70', title: 'text-white', date: 'text-white/80', amount: 'text-white font-bold', badge: 'bg-white/20 text-white' },
    media: { card: 'bg-orange-500 hover:bg-orange-600', icon: 'text-white/70', title: 'text-white', date: 'text-white/80', amount: 'text-white font-bold', badge: null },
    baja:  { card: 'bg-slate-200 hover:bg-slate-300',     icon: 'text-slate-500', title: 'text-slate-800', date: 'text-slate-500', amount: 'text-slate-800 font-bold', badge: null },
  };

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bienvenido</h1>
          <p className="text-sm text-slate2 capitalize">{fechaHoy}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarPersonalizar(true)}
            className="flex items-center gap-1.5 rounded-full border border-mist bg-white px-3 py-2 text-xs font-semibold text-slate2 shadow-sm transition-colors hover:border-brand/40 hover:text-brand"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/gastos-diarios')}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand/90 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Nuevo gasto
          </button>
        </div>
      </div>

      {/* Mobile compact strip: saldo only */}
      <div className={`md:hidden ${resumenAbierto ? 'hidden' : ''}`}>
        <div className="bg-emerald-500 rounded-xl px-4 py-2 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-white/80">Saldo disponible</p>
            <p className="text-base font-black text-white mt-1">
              {formatearMoneda(totalARS - totalGastosFijosPendientes - totalPrestamos - totalTarjetas - totalPlanesAhorro)}
            </p>
          </div>
          <PiggyBank className="h-6 w-6 text-white/60" />
        </div>
      </div>

      {/* Summary cards */}
      {visibleCount > 0 && (
        <>
          {/* Mobile accordion toggle */}
          <button
            type="button"
            onClick={() => setResumenAbierto((v) => !v)}
            className="md:hidden w-full flex items-center justify-between bg-white border border-mist rounded-xl px-4 py-3 text-sm font-semibold text-ink shadow-sm"
          >
            Resumen del mes
            <ChevronDown className={`h-4 w-4 text-slate2 transition-transform ${resumenAbierto ? 'rotate-180' : ''}`} />
          </button>

          <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 ${resumenAbierto ? '' : 'hidden md:grid'}`}>
          {visibility.saldo && (
            <div className="rounded-xl shadow-sm border border-emerald-600 bg-emerald-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <PiggyBank className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Saldo</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">disponible este mes</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalARS - totalGastosFijosPendientes - totalPrestamos - totalTarjetas - totalPlanesAhorro)}</p>
            </div>
          )}

          {visibility.dineroCuentas && (
            <div className="rounded-xl shadow-sm border border-brand/30 bg-brand p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <Wallet className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Dinero disponible</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">en cuentas ARS</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalARS)}</p>
            </div>
          )}

          {visibility.gastosDia && (
            <div className="rounded-xl shadow-sm border border-orange-400 bg-orange-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <ShoppingCart className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Gastos del Día</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">hoy</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(gastosDelDia)}</p>
            </div>
          )}

          {visibility.gastosMes && (
            <div className="rounded-xl shadow-sm border border-red-600 bg-red-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <CalendarRange className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Gastos del Mes</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">{mesLabel}</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(gastosMes)}</p>
            </div>
          )}

          {visibility.gastosFijosPendientes && (
            <div className="rounded-xl shadow-sm border border-amber-600 bg-amber-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <ClipboardList className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Gastos Fijos</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">pendientes este mes</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalGastosFijosPendientes)}</p>
            </div>
          )}

          {visibility.totalPrestamos && (
            <div className="rounded-xl shadow-sm border border-indigo-600 bg-indigo-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <Landmark className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Total Préstamos</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">cuotas mensuales</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalPrestamos)}</p>
            </div>
          )}

          {visibility.totalTarjetas && (
            <div className="rounded-xl shadow-sm border border-sky-600 bg-sky-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Total Tarjetas</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">período actual</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalTarjetas)}</p>
            </div>
          )}

          {visibility.totalPlanesAhorro && (
            <div className="rounded-xl shadow-sm border border-teal-600 bg-teal-500 p-3 flex flex-col justify-between gap-1.5">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                  <Coins className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-tight">Planes de Ahorro</p>
                  <p className="text-[9px] font-bold text-white/70 mt-0.5">cuotas pendientes</p>
                </div>
              </div>
              <p className="text-base font-black text-white leading-tight text-center md:text-left">{formatearMoneda(totalPlanesAhorro)}</p>
            </div>
          )}
          </div>

          {/* Mobile bank accounts row — below accordion */}
          {(cuentaMercadoPago || cuentasSantander[0]) && (
            <div className="md:hidden bg-white border border-mist rounded-xl shadow-sm flex divide-x divide-mist">
              {cuentaMercadoPago && (
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-3 py-3">
                  <img src="/finanzas/mercadopago.jpg" alt="Mercado Pago" className="h-18 w-auto object-contain" />
                  <p className="text-xs font-black text-ink text-center">{formatearMoneda(cuentaMercadoPago.saldoActual)}</p>
                </div>
              )}
              {cuentasSantander[0] && (
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-3 py-3">
                  <img src="/finanzas/santander.jpg" alt="Santander" className="h-18 w-auto object-contain" />
                  <p className="text-xs font-black text-ink text-center">{formatearMoneda(cuentasSantander[0].saldoActual)}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card title="Próximos Vencimientos">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <CheckCircle className="h-8 w-8 text-brand opacity-60" />
              <p className="text-sm font-semibold text-ink">Todo al día</p>
              <p className="text-xs text-slate2">Sin vencimientos próximos</p>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {notifications.slice(0, 5).map((n) => {
                const s = urgenciaStyle[n.urgencia];
                const diffDays = Math.ceil((new Date(n.fecha + 'T00:00:00').getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                const diasLabel = diffDays <= 0 ? 'vence hoy' : diffDays === 1 ? 'vence mañana' : `vence en ${diffDays} días`;
                return (
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
                    className={`w-full flex items-center justify-between p-3 rounded-xl gap-2 text-left transition-all hover:opacity-90 cursor-pointer ${s.card}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Bell className={`h-3.5 w-3.5 flex-shrink-0 ${s.icon}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${s.title}`}>{n.titulo}</p>
                        <p className={`text-xs ${s.date}`}>{formatearFecha(n.fecha)} · {diasLabel}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {n.monto != null && (
                        <span className={`text-sm ${s.amount}`}>
                          {formatearMoneda(n.monto, n.moneda ?? 'ARS')}
                        </span>
                      )}
                      {n.urgencia === 'alta' && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${s.badge}`}>
                          Urgente
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bank account balance cards — always aligned in the same row, desktop only */}
      {(cuentaMercadoPago || cuentasSantander.length > 0) && (
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cuentaMercadoPago ? (
            <div className="bg-white border-x border-mist rounded-xl shadow-sm py-3 flex items-center justify-between px-5">
              <img src="/finanzas/mercadopago.jpg" alt="Mercado Pago" className="h-28 w-auto object-contain" />
              <p className="text-base font-black text-ink">{formatearMoneda(cuentaMercadoPago.saldoActual)}</p>
            </div>
) : <div />}
          {cuentasSantander[0] ? (
            <div className="bg-white border-x border-mist rounded-xl shadow-sm py-3 flex items-center justify-between px-5">
              <img src="/finanzas/santander.jpg" alt="Santander" className="h-28 w-auto object-contain" />
              <p className="text-base font-black text-ink">{formatearMoneda(cuentasSantander[0].saldoActual)}</p>
            </div>
          ) : <div />}
        </div>
      )}

      {/* Personalizar panel */}
      {mostrarPersonalizar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-mist">
              <div>
                <h3 className="text-base font-bold text-ink">Personalizar dashboard</h3>
                <p className="text-xs text-slate2 mt-0.5">Elegí qué cards querés ver</p>
              </div>
              <button
                onClick={() => setMostrarPersonalizar(false)}
                className="p-1.5 rounded-lg text-slate2 hover:bg-mist transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-1">
              {(Object.keys(CARD_LABELS) as CardKey[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 py-3 px-3 rounded-lg hover:bg-mist/50 cursor-pointer transition-colors"
                >
                  <span className="text-sm font-medium text-ink">{CARD_LABELS[key]}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visibility[key]}
                    onClick={() => toggleCard(key)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      visibility[key] ? 'bg-brand' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                        visibility[key] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
