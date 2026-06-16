import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Check, X, Plus, Trash2 } from 'lucide-react';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import { useCuotasPlan } from '@/hooks/use-cuotas-plan';
import { useFinanzas } from '@/hooks/use-finanzas';
import type { CuotaPlanAhorro, PlanAhorro, Moneda } from '@/types';

interface Props {
  plan: PlanAhorro;
  onClose: () => void;
}

interface CuotaForm {
  numeroCuota: number;
  fechaVencimiento: string;
  importe: number;
}

export function GestionCuotasPlan({ plan, onClose }: Props) {
  const { cuotas, proximaCuota, loading, crearCuotas, marcarComoPagada, eliminarCuotas } =
    useCuotasPlan(plan.id);
  const finanzas = useFinanzas();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cuotasForm, setCuotasForm] = useState<CuotaForm[]>([]);

  const inicializarFormulario = () => {
    const totalCuotas = plan.cuotasTotales || 84;
    const importeBase = plan.importeCuota || 0;
    const fechaInicio = new Date(plan.fechaInicio);
    const nuevas: CuotaForm[] = [];

    for (let i = 1; i <= totalCuotas; i++) {
      const fechaVenc = new Date(fechaInicio);
      fechaVenc.setMonth(fechaVenc.getMonth() + i);
      nuevas.push({
        numeroCuota: i,
        fechaVencimiento: fechaVenc.toISOString().split('T')[0],
        importe: importeBase,
      });
    }

    setCuotasForm(nuevas);
    setMostrarFormulario(true);
  };

  const actualizarCuota = (index: number, campo: keyof CuotaForm, valor: string | number) => {
    const copia = [...cuotasForm];
    copia[index] = { ...copia[index], [campo]: valor };
    setCuotasForm(copia);
  };

  const agregarCuotaForm = () => {
    const ultima = cuotasForm[cuotasForm.length - 1];
    const nuevaFecha = new Date(ultima?.fechaVencimiento || plan.fechaInicio);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    setCuotasForm([
      ...cuotasForm,
      {
        numeroCuota: cuotasForm.length + 1,
        fechaVencimiento: nuevaFecha.toISOString().split('T')[0],
        importe: plan.importeCuota || 0,
      },
    ]);
  };

  const eliminarCuotaForm = (index: number) => {
    setCuotasForm(cuotasForm.filter((_, i) => i !== index));
  };

  const guardarCuotas = async () => {
    if (cuotasForm.length === 0) return;
    const payload: Omit<CuotaPlanAhorro, 'id'>[] = cuotasForm.map((c) => ({
      planId: plan.id,
      numeroCuota: c.numeroCuota,
      fechaVencimiento: c.fechaVencimiento,
      importe: c.importe,
      pagada: false,
    }));
    const result = await crearCuotas(payload);
    if (result.length > 0) {
      setMostrarFormulario(false);
      setCuotasForm([]);
    }
  };

  const eliminarTodasCuotas = async () => {
    if (window.confirm('¿Eliminar todo el historial de cuotas de este plan?')) {
      await eliminarCuotas(plan.id);
      setMostrarFormulario(false);
    }
  };

  const manejarMarcarComoPagada = async (cuotaId: string) => {
    const success = await marcarComoPagada(cuotaId);
    if (success) {
      await finanzas.actualizarPlanAhorro(plan.id, {
        cuotasPagas: plan.cuotasPagas + 1,
        fechaVencimiento:
          cuotas.find((c) => !c.pagada && c.id !== cuotaId)?.fechaVencimiento ||
          plan.fechaVencimiento,
      });
    }
  };

  const moneda = (plan.moneda as Moneda) || 'ARS';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-mist flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Detalle de Cuotas</h2>
            <p className="text-sm text-slate2">
              {plan.detalle}
              {plan.grupo ? ` (G: ${plan.grupo}${plan.orden != null ? ` O: ${plan.orden}` : ''})` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 w-9 p-0 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="text-center py-12">
              <Spinner label="Cargando cuotas..." />
            </div>
          )}

          {!loading && !mostrarFormulario && cuotas.length > 0 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-ink">Cronograma de Cuotas</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={inicializarFormulario}>
                    <Plus className="w-4 h-4" />
                    Generar / Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={eliminarTodasCuotas}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpiar
                  </Button>
                </div>
              </div>

              {proximaCuota && (
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-brand text-white px-2 py-0.5 rounded">
                          PRÓXIMA CUOTA
                        </span>
                        <h4 className="font-bold text-ink">Cuota #{proximaCuota.numeroCuota}</h4>
                      </div>
                      <p className="text-sm text-slate2">
                        Vencimiento:{' '}
                        <span className="font-medium">{formatearFecha(proximaCuota.fechaVencimiento)}</span>
                      </p>
                      <p className="text-xl font-black text-ink mt-1">
                        {formatearMoneda(proximaCuota.importe, moneda)}
                      </p>
                    </div>
                    <Button onClick={() => manejarMarcarComoPagada(proximaCuota.id)}>
                      <Check className="w-4 h-4" />
                      Marcar Pagada
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cuotas.map((cuota) => (
                  <div
                    key={cuota.id}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                      cuota.pagada
                        ? 'bg-green-50 border-green-200 shadow-sm'
                        : cuota.id === proximaCuota?.id
                        ? 'bg-white border-brand ring-1 ring-brand shadow-md'
                        : 'bg-white border-mist hover:border-slate2/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          cuota.pagada
                            ? 'bg-green-500 text-white'
                            : cuota.id === proximaCuota?.id
                            ? 'bg-brand text-white'
                            : 'bg-mist text-slate2'
                        }`}
                      >
                        {cuota.pagada ? <Check className="w-5 h-5" /> : cuota.numeroCuota}
                      </div>
                      <div>
                        <p className={`font-bold ${cuota.pagada ? 'text-green-900' : 'text-ink'}`}>
                          Cuota #{cuota.numeroCuota}
                        </p>
                        <p className="text-xs text-slate2">{formatearFecha(cuota.fechaVencimiento)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${cuota.pagada ? 'text-green-700' : 'text-ink'}`}>
                        {formatearMoneda(cuota.importe, moneda)}
                      </p>
                      {cuota.pagada && cuota.fechaPago && (
                        <p className="text-[10px] text-green-600 font-bold uppercase">
                          PAGADA {formatearFecha(cuota.fechaPago)}
                        </p>
                      )}
                      {!cuota.pagada && cuota.id !== proximaCuota?.id && (
                        <button
                          onClick={() => manejarMarcarComoPagada(cuota.id)}
                          className="text-[10px] text-brand hover:underline font-bold uppercase transition-colors"
                        >
                          Marcar pago
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mostrarFormulario && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-ink">Generar Calendario de Pagos</h3>
                  <p className="text-sm text-slate2">Ajustá los montos y fechas antes de guardar.</p>
                </div>
                <Button variant="outline" size="sm" onClick={agregarCuotaForm}>
                  <Plus className="w-4 h-4" />
                  Nueva Cuota
                </Button>
              </div>

              <div className="space-y-2 mb-4">
                {cuotasForm.map((cuota, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-paper rounded-xl border border-mist hover:border-slate2/30 transition-colors"
                  >
                    <div className="w-10 text-center font-bold text-slate2">#{cuota.numeroCuota}</div>
                    <input
                      type="date"
                      value={cuota.fechaVencimiento}
                      onChange={(e) => actualizarCuota(index, 'fechaVencimiento', e.target.value)}
                      className="flex-1 border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <div className="relative w-40">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate2 font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={cuota.importe}
                        onChange={(e) => actualizarCuota(index, 'importe', parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-mist rounded-lg focus:ring-1 focus:ring-brand outline-none"
                        placeholder="Importe"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => eliminarCuotaForm(index)}
                      className="h-9 w-9 p-0 text-red-500 border-red-100 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-mist">
                <Button variant="outline" onClick={() => setMostrarFormulario(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarCuotas} disabled={cuotasForm.length === 0}>
                  Guardar Historial
                </Button>
              </div>
            </div>
          )}

          {!loading && !mostrarFormulario && cuotas.length === 0 && (
            <div className="text-center py-16 bg-paper rounded-2xl border-2 border-dashed border-mist">
              <Calendar className="w-16 h-16 text-slate2/50 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-ink">Sin historial de pagos</h3>
              <p className="text-slate2 mb-6 max-w-xs mx-auto text-sm">
                Configurá las cuotas para ver los pagos realizados y pendientes.
              </p>
              <Button onClick={inicializarFormulario}>
                <Plus className="w-4 h-4" />
                Generar Cronograma
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
