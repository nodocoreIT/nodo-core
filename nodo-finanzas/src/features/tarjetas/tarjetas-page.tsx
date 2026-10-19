import { useState } from 'react';
import {
  CreditCard,
  Plus,
  Banknote,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Undo2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { getFechaHoy } from '@/utils/formatters';
import { ResumenTarjetas } from './resumen-tarjetas';
import { RegistroConsumo } from './registro-consumo';
import { ModalPagarTarjeta } from './modal-pagar-tarjeta';
import { calcularEstadoPagoTarjetaMes } from './calcular-estado-pago-tarjeta';
import {
  guardarInteresesFinanciacion,
  montoInteresesFinanciacion,
} from './intereses-financiacion';
import { guardarSaldoMesAnterior, montoSaldoMesAnterior } from './saldo-mes-anterior';
import { TarjetaPlastico } from './tarjeta-plastico';
import type { Tarjeta, RubroConsumo } from '@/types';

type Vista = 'resumen' | 'registro';

/** Próxima fecha de cierre (YYYY-MM-DD) a partir del día del mes, para el input type=date. */
function fechaCierreDesdeDia(diaCierre: number | undefined, referencia = new Date()): string {
  if (!diaCierre || diaCierre < 1 || diaCierre > 31) return '';

  const y = referencia.getFullYear();
  const m = referencia.getMonth();
  const hoyDia = referencia.getDate();
  const maxEsteMes = new Date(y, m + 1, 0).getDate();
  const diaEsteMes = Math.min(diaCierre, maxEsteMes);

  if (diaEsteMes >= hoyDia) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(diaEsteMes).padStart(2, '0')}`;
  }

  const nextM = m === 11 ? 0 : m + 1;
  const nextY = m === 11 ? y + 1 : y;
  const maxNext = new Date(nextY, nextM + 1, 0).getDate();
  const diaNext = Math.min(diaCierre, maxNext);
  return `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(diaNext).padStart(2, '0')}`;
}

export function TarjetasPage() {
  const finanzas = useFinanzas();
  const navigate = useNavigate();

  const [vista, setVista] = useState<Vista>('resumen');
  const [tarjetaParaRegistro, setTarjetaParaRegistro] = useState<Tarjeta | null>(null);
  const [filtroMes, setFiltroMes] = useState(getFechaHoy().slice(0, 7));
  const [tarjetaParaPago, setTarjetaParaPago] = useState<{
    tarjeta: Tarjeta;
    totalARS: number;
    totalUSD: number;
    saldoAnterior: number;
  } | null>(null);

  const cambiarMes = (incremento: number) => {
    const [anio, mes] = filtroMes.split('-').map(Number);
    const nueva = new Date(anio, mes - 1 + incremento, 1);
    const nuevoAnio = nueva.getFullYear();
    const nuevoMes = String(nueva.getMonth() + 1).padStart(2, '0');
    setFiltroMes(`${nuevoAnio}-${nuevoMes}`);
  };

  const tarjetasActivas = finanzas.tarjetas.filter((t) => t.activa);

  const resumenesDelMes = tarjetasActivas.map((tarjeta) => {
    const consumosDelMes = finanzas.consumosTarjetas.filter((c) => {
      const anioMes = c.fecha.slice(0, 7);
      return c.tarjetaId === tarjeta.id && anioMes === filtroMes;
    });

    const estado = calcularEstadoPagoTarjetaMes(
      tarjeta,
      finanzas.consumosTarjetas,
      finanzas.gastosDiarios,
      filtroMes,
    );
    const { totalARS, totalUSD, pagada, pagoParcial, montoPagado, restanteARS, marcadaSinGasto } = estado;
    const totalEnARS = totalARS + totalUSD * 1300;

    const consumosPorRubro = consumosDelMes.reduce(
      (acc, c) => {
        if (c.rubro) {
          acc[c.rubro] = (acc[c.rubro] || 0) + (c.importeARS || 0);
        }
        return acc;
      },
      {} as Record<RubroConsumo, number>
    );

    const limiteParaProgreso = tarjeta.limiteRecomendado || tarjeta.limiteCredito;
    const saldoAnterior = montoSaldoMesAnterior(finanzas.consumosTarjetas, tarjeta.id, filtroMes);
    const interesesFinanciacion = montoInteresesFinanciacion(
      finanzas.consumosTarjetas,
      tarjeta.id,
      filtroMes,
    );

    return {
      tarjeta,
      consumosDelMes,
      totalARS,
      totalUSD,
      totalEnARS,
      consumosPorRubro,
      cantidadTransacciones: consumosDelMes.length,
      porcentajeUsado: limiteParaProgreso ? (totalEnARS / limiteParaProgreso) * 100 : 0,
      limiteParaProgreso,
      pagada,
      pagoParcial,
      montoPagado,
      restanteARS,
      restanteUSD: totalUSD,
      marcadaSinGasto,
      saldoAnterior,
      interesesFinanciacion,
    };
  });

  const totalGeneralMes = resumenesDelMes.reduce((acc, r) => {
    if (r.pagada) return acc;
    if (r.pagoParcial) return acc + r.restanteARS;
    return acc + r.totalARS;
  }, 0);

  const formatearMesLabel = (fechaMes: string) => {
    const [anio, mes] = fechaMes.split('-');
    return new Date(parseInt(anio), parseInt(mes) - 1).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
  };

  if (vista === 'registro') {
    return (
      <RegistroConsumo
        onVolver={() => {
          setVista('resumen');
          setTarjetaParaRegistro(null);
        }}
        onGastoRegistrado={async () => {
          await finanzas.recargarDatos(true);
          setVista('resumen');
          setTarjetaParaRegistro(null);
        }}
        tarjetaPreseleccionada={tarjetaParaRegistro}
      />
    );
  }

  if (finanzas.loading && finanzas.tarjetas.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-paper z-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Mis Tarjetas</h1>
            <p className="text-slate2">Administrá tus tarjetas y registrá gastos</p>
          </div>
        </div>
        <Button onClick={() => setVista('registro')}>
          <Plus className="w-4 h-4" />
          Registrar Gasto
        </Button>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-mist p-4">
        <span className="text-sm font-semibold text-ink capitalize">
          {formatearMesLabel(filtroMes)}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => cambiarMes(-1)}
            className="p-1.5 rounded-lg hover:bg-mist transition-colors text-slate2"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="px-3 py-1.5 border border-mist rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand bg-paper cursor-pointer"
          />
          <button
            onClick={() => cambiarMes(1)}
            className="p-1.5 rounded-lg hover:bg-mist transition-colors text-slate2"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resumen */}
      <ResumenTarjetas
        resumenesDelMes={resumenesDelMes}
        totalGeneralMes={totalGeneralMes}
        filtroMes={filtroMes}
        cotizacion={finanzas.cotizacionDolar}
      />

      {/* Cards de tarjetas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Tarjetas Activas</h2>
          <span className="text-sm text-slate2">{tarjetasActivas.length} tarjeta{tarjetasActivas.length !== 1 ? 's' : ''}</span>
        </div>

        {tarjetasActivas.length === 0 ? (
          <div className="bg-white rounded-xl border border-mist p-8 text-center">
            <CreditCard className="w-16 h-16 text-slate2 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink mb-2">No tenés tarjetas activas</h3>
            <p className="text-slate2">Configurá tus tarjetas desde la sección de Configuración.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resumenesDelMes.map((resumen) => (
              <div
                key={resumen.tarjeta.id}
                className="bg-white rounded-2xl shadow-sm border border-mist hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                onClick={() => navigate(`/admin/tarjetas/${resumen.tarjeta.id}`)}
              >
                <TarjetaPlastico tarjeta={resumen.tarjeta} />

                <div className="p-4">
                {resumen.pagada && (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pagada
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (resumen.marcadaSinGasto) {
                          finanzas
                            .actualizarTarjeta(resumen.tarjeta.id, { pagada: false, ultimoPagoMes: undefined })
                            .then(() => finanzas.recargarDatos(true));
                          return;
                        }
                        const gastoPago = finanzas.gastosDiarios.find(
                          g => g.pagoTarjetaId === resumen.tarjeta.id && g.fecha.startsWith(filtroMes)
                        );
                        if (gastoPago) finanzas.eliminarGastoDiario(gastoPago.id).then(() => finanzas.recargarDatos(true));
                      }}
                      className="flex items-center gap-1 text-xs text-slate2 hover:text-ink transition-colors"
                      title="Deshacer pago"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Deshacer
                    </button>
                  </div>
                )}
                {resumen.pagoParcial && (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Pago parcial
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const gastoPago = finanzas.gastosDiarios.find(
                          g => g.pagoTarjetaId === resumen.tarjeta.id && g.fecha.startsWith(filtroMes)
                        );
                        if (gastoPago) finanzas.eliminarGastoDiario(gastoPago.id).then(() => finanzas.recargarDatos(true));
                      }}
                      className="flex items-center gap-1 text-xs text-slate2 hover:text-ink transition-colors"
                      title="Deshacer pago"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Deshacer
                    </button>
                  </div>
                )}
                {!resumen.pagada && !resumen.pagoParcial && (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate2">
                      <CreditCard className="w-3.5 h-3.5" />
                      Sin pagar
                    </span>
                    <label
                      className="flex items-center gap-1.5 text-xs text-slate2 hover:text-ink cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      title="Marcar como pagada sin registrar un gasto"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => {
                          finanzas
                            .actualizarTarjeta(resumen.tarjeta.id, { pagada: true, ultimoPagoMes: filtroMes })
                            .then(() => finanzas.recargarDatos(true));
                        }}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                      Marcar pagada
                    </label>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate2">
                      {resumen.pagada ? 'Pagado:' : resumen.pagoParcial ? 'Pendiente:' : 'Total del mes:'}
                    </span>
                    <span className={`font-bold text-lg ${resumen.pagoParcial ? 'text-red-600' : 'text-ink'}`}>
                      ${(resumen.pagada ? resumen.totalARS : resumen.restanteARS).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoneyInput
                      label="Saldo del mes anterior"
                      moneda="ARS"
                      value={resumen.saldoAnterior}
                      onChange={() => {}}
                      onBlur={(valor) => {
                        if (Math.abs(valor - resumen.saldoAnterior) <= 0.001) return;
                        void guardarSaldoMesAnterior(finanzas, resumen.tarjeta.id, filtroMes, valor);
                      }}
                    />
                    {resumen.saldoAnterior > 0 && (
                      <div className="mt-2">
                        <MoneyInput
                          label="Intereses de financiación"
                          moneda="ARS"
                          value={resumen.interesesFinanciacion}
                          onChange={() => {}}
                          onBlur={(valor) => {
                            if (Math.abs(valor - resumen.interesesFinanciacion) <= 0.001) return;
                            void guardarInteresesFinanciacion(
                              finanzas,
                              resumen.tarjeta.id,
                              filtroMes,
                              valor,
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate2">Transacciones:</span>
                    <span className="font-medium text-ink">{resumen.cantidadTransacciones}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1 text-slate2">
                      <Calendar className="w-3.5 h-3.5" />
                      Día de Cierre:
                    </span>
                    <input
                      type="date"
                      value={fechaCierreDesdeDia(resumen.tarjeta.diaCierre)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        const iso = e.target.value;
                        const dia = iso ? Number(iso.slice(8, 10)) : undefined;
                        finanzas.actualizarTarjeta(resumen.tarjeta.id, {
                          diaCierre: dia,
                        });
                      }}
                      className="text-sm font-semibold text-ink border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-0 text-right"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1 text-slate2">
                      <Calendar className="w-3.5 h-3.5" />
                      Vencimiento:
                    </span>
                    <input
                      type="date"
                      value={resumen.tarjeta.fechaVencimiento ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        finanzas.actualizarTarjeta(resumen.tarjeta.id, {
                          fechaVencimiento: e.target.value || undefined,
                        });
                      }}
                      className="text-sm font-semibold text-ink border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-0 text-right"
                    />
                  </div>

                  {/* Progress bar */}
                  {resumen.limiteParaProgreso && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate2">Límite usado</span>
                        <span className={`font-medium ${
                          resumen.porcentajeUsado > 80
                            ? 'text-red-600'
                            : resumen.porcentajeUsado > 60
                            ? 'text-yellow-600'
                            : 'text-brand'
                        }`}>
                          {resumen.porcentajeUsado.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-mist">
                        <div
                          className={`h-2 rounded-full ${
                            resumen.porcentajeUsado > 80
                              ? 'bg-red-500'
                              : resumen.porcentajeUsado > 60
                              ? 'bg-yellow-500'
                              : 'bg-brand'
                          }`}
                          style={{ width: `${Math.min(resumen.porcentajeUsado, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={resumen.pagada}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTarjetaParaPago({
                        tarjeta: resumen.tarjeta,
                        totalARS: resumen.restanteARS,
                        totalUSD: resumen.restanteUSD ?? resumen.totalUSD,
                        saldoAnterior: resumen.saldoAnterior,
                      });
                    }}
                  >
                    <Banknote className="w-4 h-4" />
                    {resumen.pagada ? 'Pagada' : 'Pagar'}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTarjetaParaRegistro(resumen.tarjeta);
                      setVista('registro');
                    }}
                  >
                    <Receipt className="w-4 h-4" />
                    Gasto
                  </Button>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal pago tarjeta */}
      {tarjetaParaPago && (
        <ModalPagarTarjeta
          open={true}
          tarjeta={tarjetaParaPago.tarjeta}
          totalARS={tarjetaParaPago.totalARS}
          totalUSD={tarjetaParaPago.totalUSD}
          saldoAnteriorInicial={tarjetaParaPago.saldoAnterior}
          filtroMes={filtroMes}
          onClose={() => setTarjetaParaPago(null)}
          onConfirm={async ({ montoARS, montoUSD, esParcial, interesFinanciacion, saldoAnterior, totalResumenARS }) => {
            await guardarSaldoMesAnterior(finanzas, tarjetaParaPago.tarjeta.id, filtroMes, saldoAnterior);
            await finanzas.agregarGastoDiario({
              descripcion: `Pago tarjeta ${tarjetaParaPago.tarjeta.nombre}`,
              detalle: `Pago ${esParcial ? 'parcial' : 'total'} — ${formatearMesLabel(filtroMes)}`,
              monto: montoARS,
              montoUSD: montoUSD > 0 ? montoUSD : undefined,
              fecha: getFechaHoy(),
              formaPago: 'TRANSFERENCIA BANCO',
              pagoTarjetaId: tarjetaParaPago.tarjeta.id,
              pagoParcial: esParcial,
              interesFinanciacion: esParcial ? interesFinanciacion : 0,
              totalResumenARS,
            });
            await finanzas.recargarDatos(true);
          }}
        />
      )}
    </div>
  );
}
