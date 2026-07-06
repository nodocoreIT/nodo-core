import { useState } from 'react';
import {
  CreditCard,
  Plus,
  Eye,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { getFechaHoy } from '@/utils/formatters';
import { ResumenTarjetas } from './resumen-tarjetas';
import { RegistroConsumo } from './registro-consumo';
import type { Tarjeta, RubroConsumo } from '@/types';

type Vista = 'resumen' | 'registro';

export function TarjetasPage() {
  const finanzas = useFinanzas();
  const navigate = useNavigate();

  const [vista, setVista] = useState<Vista>('resumen');
  const [tarjetaParaRegistro, setTarjetaParaRegistro] = useState<Tarjeta | null>(null);
  const [filtroMes, setFiltroMes] = useState(getFechaHoy().slice(0, 7));

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
      const anioMes = new Date(c.fecha).toISOString().slice(0, 7);
      return c.tarjetaId === tarjeta.id && anioMes === filtroMes;
    });

    const totalARS = consumosDelMes.reduce((a, c) => a + (c.importeARS || 0), 0);
    const totalUSD = consumosDelMes.reduce((a, c) => a + (c.importeUSD || 0), 0);
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

    const gastoPago = finanzas.gastosDiarios.find((g) => {
      const matchId = g.pagoTarjetaId === tarjeta.id;
      const matchFecha = g.fecha.startsWith(filtroMes);
      return matchId && matchFecha;
    });

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
      pagada: !!gastoPago && !gastoPago.pagoParcial,
      pagoParcial: !!gastoPago && !!gastoPago.pagoParcial,
      montoPagado: gastoPago?.monto || 0,
      restanteARS: !!gastoPago ? Math.max(0, totalARS - (gastoPago.monto || 0)) : totalARS,
      restanteUSD: totalUSD,
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
                className="bg-white rounded-xl shadow-sm border border-mist p-5 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                onClick={() => navigate(`/admin/tarjetas/${resumen.tarjeta.id}`)}
              >
                {/* Status banner */}
                {resumen.pagada && (
                  <div className="bg-green-600 text-white px-5 py-2 -mx-5 -mt-5 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Tarjeta Pagada</span>
                  </div>
                )}
                {resumen.pagoParcial && (
                  <div className="bg-orange-500 text-white px-5 py-2 -mx-5 -mt-5 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Pago Parcial</span>
                  </div>
                )}

                {/* Card info */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-ink text-lg">{resumen.tarjeta.nombre}</h3>
                    <p className="text-sm text-slate2">{resumen.tarjeta.banco}</p>
                    <p className="text-xs text-slate2">Titular: {resumen.tarjeta.titular}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full font-bold uppercase ${
                    resumen.tarjeta.tipo === 'VISA'
                      ? 'bg-blue-100 text-blue-800'
                      : resumen.tarjeta.tipo === 'MASTERCARD'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {resumen.tarjeta.tipo}
                  </span>
                </div>

                {/* Totales */}
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
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate2">Transacciones:</span>
                    <span className="font-medium text-ink">{resumen.cantidadTransacciones}</span>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/tarjetas/${resumen.tarjeta.id}`);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    Historial
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
