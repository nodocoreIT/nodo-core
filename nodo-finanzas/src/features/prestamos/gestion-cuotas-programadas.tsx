import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Check, X, Plus, Trash2 } from 'lucide-react';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import { useCuotasProgramadas } from '@/hooks/use-cuotas-programadas';
import type { CuotaProgramada, Prestamo } from '@/types';

interface Props {
  prestamo: Prestamo;
  onClose: () => void;
}

interface CuotaForm {
  numeroCuota: number;
  fechaVencimiento: string;
  importeTotal: number;
}

export function GestionCuotasProgramadas({ prestamo, onClose }: Props) {
  const { cuotas, cuotaActual, loading, crearCuotas, marcarComoPagada, eliminarCuotas } =
    useCuotasProgramadas(prestamo.id);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cuotasForm, setCuotasForm] = useState<CuotaForm[]>([]);

  const inicializarFormulario = () => {
    const totalCuotas = prestamo.cuotasTotales || 12;
    const importeBase = prestamo.importeCuota || 0;
    const fechaInicio = new Date(prestamo.fechaInicio);
    const nuevas: CuotaForm[] = [];

    for (let i = 1; i <= totalCuotas; i++) {
      const fechaVenc = new Date(fechaInicio);
      fechaVenc.setMonth(fechaVenc.getMonth() + i);
      nuevas.push({
        numeroCuota: i,
        fechaVencimiento: fechaVenc.toISOString().split('T')[0],
        importeTotal: importeBase,
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
    const nuevaFecha = new Date(ultima?.fechaVencimiento || prestamo.fechaInicio);
    nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
    setCuotasForm([
      ...cuotasForm,
      {
        numeroCuota: cuotasForm.length + 1,
        fechaVencimiento: nuevaFecha.toISOString().split('T')[0],
        importeTotal: prestamo.importeCuota || 0,
      },
    ]);
  };

  const eliminarCuotaForm = (index: number) => {
    setCuotasForm(cuotasForm.filter((_, i) => i !== index));
  };

  const guardarCuotas = async () => {
    if (cuotasForm.length === 0) return;
    const payload: Omit<CuotaProgramada, 'id'>[] = cuotasForm.map((c) => ({
      prestamoId: prestamo.id,
      numeroCuota: c.numeroCuota,
      fechaVencimiento: c.fechaVencimiento,
      importeTotal: c.importeTotal,
      pagada: false,
    }));
    const result = await crearCuotas(payload);
    if (result.length > 0) {
      setMostrarFormulario(false);
      setCuotasForm([]);
    }
  };

  const eliminarTodasCuotas = async () => {
    if (window.confirm('¿Eliminar todas las cuotas programadas?')) {
      await eliminarCuotas(prestamo.id);
      inicializarFormulario();
    }
  };

  const moneda = (prestamo.moneda as 'ARS' | 'USD') || 'ARS';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-mist">
          <div>
            <h2 className="text-lg font-bold text-ink">Cuotas Programadas</h2>
            <p className="text-sm text-slate2">{prestamo.concepto}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="text-center py-8">
              <Spinner />
            </div>
          )}

          {!loading && !mostrarFormulario && cuotas.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-ink">Cronograma de Cuotas</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={inicializarFormulario}>
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                  <Button variant="danger" size="sm" onClick={eliminarTodasCuotas}>
                    <Trash2 className="w-4 h-4" />
                    Eliminar Todas
                  </Button>
                </div>
              </div>

              {cuotaActual && (
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-ink">Cuota Actual</h4>
                      <p className="text-sm text-slate2">
                        #{cuotaActual.numeroCuota} · Vence: {formatearFecha(cuotaActual.fechaVencimiento)}
                      </p>
                      <p className="text-lg font-black text-brand mt-1">
                        {formatearMoneda(cuotaActual.importeTotal, moneda)}
                      </p>
                    </div>
                    {!cuotaActual.pagada && (
                      <Button size="sm" onClick={() => marcarComoPagada(cuotaActual.id)}>
                        <Check className="w-4 h-4" />
                        Marcar Pagada
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cuotas.map((cuota) => (
                  <div
                    key={cuota.id}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                      cuota.pagada ? 'bg-green-50 border-green-200' : 'bg-white border-mist'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          cuota.pagada ? 'bg-green-500 text-white' : 'bg-mist text-slate2'
                        }`}
                      >
                        {cuota.pagada ? <Check className="w-4 h-4" /> : cuota.numeroCuota}
                      </div>
                      <div>
                        <p className="font-medium text-ink">Cuota #{cuota.numeroCuota}</p>
                        <p className="text-xs text-slate2">Vence: {formatearFecha(cuota.fechaVencimiento)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-ink">{formatearMoneda(cuota.importeTotal, moneda)}</p>
                      {cuota.pagada && cuota.fechaPago && (
                        <p className="text-xs text-green-600">Pagada: {formatearFecha(cuota.fechaPago)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mostrarFormulario && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-ink">Configurar Cuotas</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={agregarCuotaForm}>
                    <Plus className="w-4 h-4" />
                    Agregar Cuota
                  </Button>
                  {cuotasForm.length === 0 && (
                    <Button variant="secondary" size="sm" onClick={inicializarFormulario}>
                      Generar Automático
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {cuotasForm.map((cuota, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-paper rounded-xl border border-mist">
                    <div className="w-10 text-center font-bold text-slate2">#{cuota.numeroCuota}</div>
                    <input
                      type="date"
                      value={cuota.fechaVencimiento}
                      onChange={(e) => actualizarCuota(index, 'fechaVencimiento', e.target.value)}
                      className="flex-1 border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={cuota.importeTotal}
                      onChange={(e) => actualizarCuota(index, 'importeTotal', parseFloat(e.target.value) || 0)}
                      className="w-32 border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder="Importe"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => eliminarCuotaForm(index)}
                      className="h-9 w-9 p-0 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setMostrarFormulario(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarCuotas} disabled={cuotasForm.length === 0}>
                  Guardar Cuotas
                </Button>
              </div>
            </>
          )}

          {!loading && !mostrarFormulario && cuotas.length === 0 && (
            <div className="text-center py-10">
              <Calendar className="w-12 h-12 text-slate2 mx-auto mb-4" />
              <p className="text-slate2 mb-4">No hay cuotas programadas</p>
              <Button onClick={inicializarFormulario}>
                <Plus className="w-4 h-4" />
                Configurar Cuotas
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
