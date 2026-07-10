import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  ExternalLink,
  Banknote,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { FormSelect } from '@nodocore/shared-components';
import { Spinner } from '@/components/ui/spinner';
import { useLocation } from 'react-router-dom';
import { useFinanzas } from '@/hooks/use-finanzas';
import { formatearMoneda, formatearFecha, getFechaHoy } from '@/utils/formatters';
import { GestionCuotasPlan } from './gestion-cuotas-plan';
import toast from 'react-hot-toast';
import type { PlanAhorro, Moneda, FormaDePago } from '@/types';

interface FormState {
  detalle: string;
  grupo: string;
  orden: number;
  valorMovil: number;
  saldoCancelacion: number;
  fechaInicio: string;
  cuotasTotales: number;
  cuotasPagas: number;
  cuotasAdelantadas: number;
  importeCuota: number;
  moneda: Moneda;
  fechaVencimiento: string;
  activa: boolean;
  linkPago: string;
  modeloReferencia: string;
}

const defaultForm = (): FormState => ({
  detalle: '',
  grupo: '',
  orden: 1,
  valorMovil: 0,
  saldoCancelacion: 0,
  fechaInicio: getFechaHoy(),
  cuotasTotales: 84,
  cuotasPagas: 0,
  cuotasAdelantadas: 0,
  importeCuota: 0,
  moneda: 'ARS',
  fechaVencimiento: getFechaHoy(),
  activa: true,
  linkPago: '',
  modeloReferencia: '',
});

function calcularCuotasPagas(fechaInicio: string, cuotasTotales: number, cuotasAdelantadas: number): number {
  if (!fechaInicio) return 0;
  const hoy = new Date();
  const inicio = new Date(fechaInicio + 'T12:00:00');
  const anios = hoy.getFullYear() - inicio.getFullYear();
  const meses = hoy.getMonth() - inicio.getMonth();
  let total = anios * 12 + meses + cuotasAdelantadas;
  if (total < 0) total = 0;
  if (total > cuotasTotales) total = cuotasTotales;
  return total;
}

function esVencimientoProximo(fecha: string): boolean {
  if (!fecha) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + 'T12:00:00');
  venc.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 2;
}

function calcularDiasRestantes(fecha: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + 'T12:00:00');
  venc.setHours(0, 0, 0, 0);
  return Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function PlanesAhorroPage() {
  const finanzas = useFinanzas();
  const location = useLocation();
  const openId = (location.state as { openId?: string } | null)?.openId;

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [planEditando, setPlanEditando] = useState<PlanAhorro | null>(null);
  const [planParaCuotas, setPlanParaCuotas] = useState<PlanAhorro | null>(null);
  const [planParaMarcarPagado, setPlanParaMarcarPagado] = useState<PlanAhorro | null>(null);
  const [planParaPagar, setPlanParaPagar] = useState<PlanAhorro | null>(null);
  const [pagoFormaPago, setPagoFormaPago] = useState<FormaDePago>('TRANSFERENCIA BANCO');
  const [pagoCuentaId, setPagoCuentaId] = useState<string>('');
  const [pagoTarjetaId, setPagoTarjetaId] = useState<string>('');
  const [pagoGuardando, setPagoGuardando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());

  // Auto-calculate cuotasPagas when fechaInicio, cuotasTotales or cuotasAdelantadas change
  useEffect(() => {
    if (!mostrarFormulario) return;
    const calculated = calcularCuotasPagas(form.fechaInicio, form.cuotasTotales, form.cuotasAdelantadas);
    setForm((prev) => ({ ...prev, cuotasPagas: calculated }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fechaInicio, form.cuotasTotales, form.cuotasAdelantadas, mostrarFormulario]);

  // Auto-calculate saldoCancelacion from valorMovil
  useEffect(() => {
    if (!mostrarFormulario) return;
    if (form.valorMovil > 0 && form.cuotasTotales > 0) {
      const cuotaPura = form.valorMovil / form.cuotasTotales;
      const cuotasRestantes = form.cuotasTotales - form.cuotasPagas;
      const saldo = Math.round(cuotaPura * cuotasRestantes * 100) / 100;
      if (Math.abs(form.saldoCancelacion - saldo) > 1) {
        setForm((prev) => ({ ...prev, saldoCancelacion: saldo }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.valorMovil, form.cuotasTotales, form.cuotasPagas, mostrarFormulario]);

  const set = (campo: keyof FormState, valor: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const abrirFormulario = (plan?: PlanAhorro) => {
    if (plan) {
      setPlanEditando(plan);
      setForm({
        detalle: plan.detalle,
        grupo: plan.grupo || '',
        orden: plan.orden ?? 1,
        valorMovil: plan.valorMovil || 0,
        saldoCancelacion: plan.saldoCancelacion || 0,
        fechaInicio: plan.fechaInicio,
        cuotasTotales: plan.cuotasTotales,
        cuotasPagas: plan.cuotasPagas,
        cuotasAdelantadas: plan.cuotasAdelantadas || 0,
        importeCuota: plan.importeCuota,
        moneda: plan.moneda as Moneda,
        fechaVencimiento: plan.fechaVencimiento,
        activa: plan.activa,
        linkPago: plan.linkPago || '',
        modeloReferencia: plan.modeloReferencia || '',
      });
    } else {
      setPlanEditando(null);
      setForm(defaultForm());
    }
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setPlanEditando(null);
    setForm(defaultForm());
  };

  useEffect(() => {
    if (!openId || finanzas.loading) return;
    const plan = finanzas.planesAhorro.find((p) => p.id === openId);
    if (plan) abrirFormulario(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, finanzas.loading]);

  const handleGuardar = async () => {
    if (!form.detalle.trim()) {
      toast.error('El detalle es requerido');
      return;
    }
    if (form.importeCuota <= 0) {
      toast.error('El importe de cuota debe ser mayor a 0');
      return;
    }
    setGuardando(true);
    try {
      const payload: Omit<PlanAhorro, 'id'> = {
        detalle: form.detalle,
        grupo: form.grupo || undefined,
        orden: form.orden,
        valorMovil: form.valorMovil,
        saldoCancelacion: form.saldoCancelacion,
        fechaInicio: form.fechaInicio,
        cuotasTotales: form.cuotasTotales,
        cuotasPagas: form.cuotasPagas,
        cuotasAdelantadas: form.cuotasAdelantadas,
        importeCuota: form.importeCuota,
        moneda: form.moneda,
        fechaVencimiento: form.fechaVencimiento,
        activa: form.activa,
        linkPago: form.linkPago || undefined,
        modeloReferencia: form.modeloReferencia || undefined,
      };
      if (planEditando) {
        await finanzas.actualizarPlanAhorro(planEditando.id, payload);
        toast.success('Plan actualizado');
      } else {
        await finanzas.agregarPlanAhorro(payload);
        toast.success('Plan creado');
      }
      cerrarFormulario();
    } catch {
      toast.error('Error guardando el plan');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!window.confirm('¿Eliminar este plan de ahorro?')) return;
    try {
      await finanzas.eliminarPlanAhorro(id);
      toast.success('Plan eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const marcarCuotaPagada = async (plan: PlanAhorro) => {
    try {
      const fechaActual = new Date(plan.fechaVencimiento + 'T12:00:00');
      fechaActual.setMonth(fechaActual.getMonth() + 1);
      const nuevaFechaVencimiento = fechaActual.toISOString().split('T')[0];
      await finanzas.actualizarPlanAhorro(plan.id, {
        cuotasPagas: plan.cuotasPagas + 1,
        fechaVencimiento: nuevaFechaVencimiento,
      });
      toast.success('Cuota marcada como pagada');
      setPlanParaMarcarPagado(null);
    } catch {
      toast.error('Error al marcar la cuota como pagada');
    }
  };

  const handlePagarPlan = async () => {
    if (!planParaPagar) return;
    setPagoGuardando(true);
    try {
      const fechaActual = new Date(planParaPagar.fechaVencimiento + 'T12:00:00');
      fechaActual.setMonth(fechaActual.getMonth() + 1);
      const nuevaFechaVencimiento = fechaActual.toISOString().split('T')[0];

      await finanzas.agregarGastoDiario({
        descripcion: `Cuota plan de ahorro: ${planParaPagar.detalle}`,
        monto: planParaPagar.importeCuota,
        montoUSD: planParaPagar.moneda === 'USD' ? planParaPagar.importeCuota : undefined,
        fecha: getFechaHoy(),
        formaPago: pagoFormaPago,
        cuentaId: pagoFormaPago !== 'TARJETA' ? (pagoCuentaId || undefined) : undefined,
        tarjetaId: pagoFormaPago === 'TARJETA' ? (pagoTarjetaId || undefined) : undefined,
        planId: planParaPagar.id,
      });

      await finanzas.actualizarPlanAhorro(planParaPagar.id, {
        cuotasPagas: planParaPagar.cuotasPagas + 1,
        fechaVencimiento: nuevaFechaVencimiento,
      });

      toast.success('Pago registrado correctamente');
      setPlanParaPagar(null);
      setPagoFormaPago('TRANSFERENCIA BANCO');
      setPagoCuentaId('');
      setPagoTarjetaId('');
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setPagoGuardando(false);
    }
  };

  if (finanzas.loading && finanzas.planesAhorro.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const planes = [...(finanzas.planesAhorro || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Planes de Ahorro</h1>
            <p className="text-slate2">Gestioná y seguí tus planes de ahorro</p>
          </div>
        </div>
        <Button onClick={() => abrirFormulario()}>
          <Plus className="w-4 h-4" />
          Agregar Plan
        </Button>
      </div>

      {/* Plan cards */}
      {planes.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-mist">
          <Wallet className="w-16 h-16 text-slate2/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-ink mb-1">Sin planes registrados</h3>
          <p className="text-slate2 mb-6 text-sm">Agregá tu primer plan de ahorro.</p>
          <Button onClick={() => abrirFormulario()}>
            <Plus className="w-4 h-4" />
            Comenzar ahora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {planes.map((plan) => {
            const proximo = esVencimientoProximo(plan.fechaVencimiento);
            const progreso = plan.cuotasTotales > 0 ? (plan.cuotasPagas / plan.cuotasTotales) * 100 : 0;
            const capitalizado = (plan.valorMovil || 0) - (plan.saldoCancelacion || 0);
            const moneda = plan.moneda as Moneda;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl shadow-sm border border-mist border-l-4 p-5 space-y-4 hover:shadow-md transition-all ${
                  proximo ? 'border-l-red-500' : 'border-l-brand'
                }`}
              >
                {/* Plan header with badges */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-ink truncate">{plan.detalle}</h3>
                    <p className="text-xs text-slate2 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                      Inicio: {formatearFecha(plan.fechaInicio)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    {plan.grupo && (
                      <span className="px-2 py-0.5 bg-brand text-white text-[10px] font-bold rounded uppercase tracking-wider">
                        {plan.grupo}
                      </span>
                    )}
                    {plan.orden != null && (
                      <span className="px-1.5 py-0.5 bg-ink text-white text-[9px] font-black rounded">
                        #{plan.orden}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vencimiento próximo banner */}
                {proximo && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Vencimiento Próximo</span>
                  </div>
                )}

                {/* Dark panel: valorMovil / saldoCancelacion */}
                {(plan.valorMovil || plan.saldoCancelacion) ? (
                  <div className="bg-slate-900 rounded-xl p-3 text-white space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Valor Móvil Hoy
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        {formatearMoneda(plan.valorMovil || 0, moneda)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Saldo Cancelación
                      </span>
                      <span className="text-sm font-black text-rose-400">
                        {formatearMoneda(plan.saldoCancelacion || 0, moneda)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-slate-300 font-black uppercase tracking-wider">
                        Capital Ganado
                      </span>
                      <span className="text-lg font-black text-white">
                        {formatearMoneda(capitalizado, moneda)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Cuotas grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-paper p-3 rounded-xl border border-mist">
                    <p className="text-[10px] text-slate2 uppercase font-bold tracking-wider mb-1">Cuota Actual</p>
                    <p className="text-xl font-black text-brand">
                      {plan.cuotasPagas + 1}
                      <span className="text-sm font-normal text-slate2 ml-1">/ {plan.cuotasTotales}</span>
                    </p>
                  </div>
                  <div className="bg-paper p-3 rounded-xl border border-mist">
                    <p className="text-[10px] text-slate2 uppercase font-bold tracking-wider mb-1">Importe</p>
                    <p className="text-base font-bold text-ink">{formatearMoneda(plan.importeCuota, moneda)}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate2">Progreso</span>
                    <span className="text-brand">{progreso.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-mist">
                    <div
                      className="h-2 rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                </div>

                {/* Vencimiento row */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    proximo ? 'bg-red-50 border-red-100' : 'bg-brand/5 border-brand/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar
                      className={`w-5 h-5 shrink-0 ${proximo ? 'text-red-600' : 'text-brand'}`}
                      strokeWidth={2.25}
                    />
                    <div>
                      <p
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          proximo ? 'text-red-700' : 'text-brand'
                        }`}
                      >
                        Próximo Vto
                      </p>
                      <p className={`text-sm font-bold ${proximo ? 'text-red-600' : 'text-ink'}`}>
                        {formatearFecha(plan.fechaVencimiento)}
                      </p>
                      {(() => {
                        const dias = calcularDiasRestantes(plan.fechaVencimiento);
                        if (dias === null) return null;
                        return (
                          <p
                            className={`text-[10px] font-bold ${
                              dias < 0 ? 'text-red-500' : dias <= 2 ? 'text-red-400' : 'text-slate2'
                            }`}
                          >
                            {dias < 0
                              ? `${Math.abs(dias)}d de atraso`
                              : dias === 0
                              ? 'Vence hoy'
                              : `${dias}d restantes`}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  {plan.cuotasPagas === plan.cuotasTotales ? (
                    <CheckCircle2 className="w-7 h-7 text-green-500 shrink-0" strokeWidth={2.25} />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlanParaPagar(plan);
                        setPagoFormaPago('TRANSFERENCIA BANCO');
                        setPagoCuentaId('');
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                        proximo
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-brand text-white hover:bg-brand/90'
                      }`}
                    >
                      PAGAR
                      <Banknote className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-mist">
                  <Button
                    variant="outline"
                    onClick={() => setPlanParaCuotas(plan)}
                    className="h-14 w-14 min-w-14 p-0 shrink-0 rounded-xl border-2 border-mist hover:border-brand/30 hover:bg-brand/5 [&_svg]:!size-8"
                    title="Ver historial de cuotas"
                  >
                    <Calendar className="text-brand" strokeWidth={2.5} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => abrirFormulario(plan)}
                    className="h-14 w-14 min-w-14 p-0 shrink-0 rounded-xl border-2 border-mist hover:border-brand/30 hover:bg-brand/5 [&_svg]:!size-8"
                    title="Editar plan"
                  >
                    <Edit className="text-brand" strokeWidth={2.5} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleEliminar(plan.id)}
                    className="h-14 w-14 min-w-14 p-0 shrink-0 rounded-xl border-2 border-mist hover:border-red-200 hover:bg-red-50 [&_svg]:!size-8"
                    title="Eliminar plan"
                  >
                    <Trash2 className="text-red-500" strokeWidth={2.5} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-mist flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-brand rounded">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-ink">
                  {planEditando ? 'Editar Plan' : 'Nuevo Plan de Ahorro'}
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={cerrarFormulario} className="h-9 w-9 p-0 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Identificacion */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-xs font-bold text-slate2 uppercase tracking-wider mb-1.5">
                    Detalle del Plan
                  </label>
                  <input
                    type="text"
                    value={form.detalle}
                    onChange={(e) => set('detalle', e.target.value)}
                    placeholder="Ej: Plan Ford Territory"
                    className="w-full border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-xs font-bold text-slate2 uppercase tracking-wider mb-1.5">Grupo</label>
                  <input
                    type="text"
                    value={form.grupo}
                    onChange={(e) => set('grupo', e.target.value)}
                    placeholder="N° Grupo"
                    className="w-full border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-xs font-bold text-slate2 uppercase tracking-wider mb-1.5">Orden</label>
                  <input
                    type="number"
                    value={form.orden}
                    onChange={(e) => set('orden', parseInt(e.target.value) || 1)}
                    className="w-full border border-mist rounded-lg px-3 py-2 text-sm text-ink text-center focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="col-span-12">
                  <label className="block text-xs font-bold text-brand uppercase tracking-wider mb-1.5">
                    Modelo de Referencia
                  </label>
                  <FormSelect
                    value={form.modeloReferencia}
                    onChange={(value) => set('modeloReferencia', value)}
                    options={[
                      { value: 'maverick', label: 'Ford Maverick (XLT)' },
                      { value: 'territory', label: 'Ford Territory (SEL)' },
                    ]}
                    allowEmpty
                    emptyLabel="Ninguno"
                  />
                </div>
              </div>

              {/* Valor Movil / Saldo Cancelacion */}
              <div className="bg-paper rounded-xl border border-mist p-4 grid grid-cols-2 gap-4">
                <MoneyInput
                  label="Valor Móvil Hoy"
                  value={form.valorMovil}
                  onChange={(v) => set('valorMovil', v)}
                  moneda={form.moneda}
                />
                <MoneyInput
                  label="Saldo Liquidación"
                  value={form.saldoCancelacion}
                  onChange={(v) => set('saldoCancelacion', v)}
                  moneda={form.moneda}
                />
              </div>

              {/* Fechas y cuotas */}
              <div>
                <p className="text-[9px] uppercase font-black text-slate2 tracking-widest border-b border-mist pb-1 mb-4">
                  Cronología y Estado del Plan
                </p>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-xs font-bold text-slate2 mb-1.5">Fecha Inicio</label>
                    <input
                      type="date"
                      value={form.fechaInicio}
                      onChange={(e) => set('fechaInicio', e.target.value)}
                      className="w-full border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-xs font-bold text-slate2 mb-1.5">Próximo Vto</label>
                    <input
                      type="date"
                      value={form.fechaVencimiento}
                      onChange={(e) => set('fechaVencimiento', e.target.value)}
                      className="w-full border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6 grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate2 uppercase text-center mb-1.5">
                        Totales
                      </label>
                      <input
                        type="number"
                        value={form.cuotasTotales}
                        onChange={(e) => set('cuotasTotales', parseInt(e.target.value) || 1)}
                        className="w-full border border-mist rounded-lg px-1 py-2 text-sm text-ink text-center focus:outline-none focus:ring-2 focus:ring-brand font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate2 uppercase text-center mb-1.5">
                        Adelant.
                      </label>
                      <input
                        type="number"
                        value={form.cuotasAdelantadas}
                        onChange={(e) => set('cuotasAdelantadas', parseInt(e.target.value) || 0)}
                        className="w-full border border-green-200 bg-green-50 rounded-lg px-1 py-2 text-sm text-green-700 text-center focus:outline-none focus:ring-2 focus:ring-green-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate2 uppercase text-center mb-1.5">
                        Pagas
                      </label>
                      <div className="h-9 flex items-center justify-center bg-brand/10 rounded-lg border border-brand/20 text-brand font-black text-sm">
                        {form.cuotasPagas}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate2 uppercase text-center mb-1.5">
                        Rest.
                      </label>
                      <div className="h-9 flex items-center justify-center bg-paper rounded-lg border border-mist text-slate2 font-black text-sm">
                        {form.cuotasTotales - form.cuotasPagas}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Importe y moneda */}
              <div className="grid grid-cols-2 gap-4">
                <MoneyInput
                  label="Importe de Cuota"
                  value={form.importeCuota}
                  onChange={(v) => set('importeCuota', v)}
                  moneda={form.moneda}
                />
                <div>
                  <label className="block text-xs font-bold text-slate2 uppercase tracking-wider mb-1.5">
                    Moneda
                  </label>
                  <FormSelect
                    value={form.moneda}
                    onChange={(value) => set('moneda', value as Moneda)}
                    options={[
                      { value: 'ARS', label: 'Pesos (ARS)' },
                      { value: 'USD', label: 'Dólares (USD)' },
                    ]}
                  />
                </div>
              </div>

              {/* Link de pago */}
              <div className="bg-brand/5 rounded-xl border border-brand/20 p-4">
                <label className="flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider mb-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Link de Pago (Ej: MercadoPago)
                </label>
                <input
                  type="url"
                  value={form.linkPago}
                  onChange={(e) => set('linkPago', e.target.value)}
                  placeholder="https://www.mercadopago.com.ar/servicios"
                  className="w-full border border-brand/20 rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                />
                <p className="text-[9px] text-slate2 mt-1 italic">
                  Pegá aquí el link de pago para acceso directo.
                </p>
              </div>

              {/* Plan activo toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('activa', !form.activa)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    form.activa ? 'bg-brand' : 'bg-slate2/30'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.activa ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
                <span className="text-sm font-bold text-slate2">Plan Activo</span>
              </div>
            </div>

            <div className="p-5 border-t border-mist flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={cerrarFormulario}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : planEditando ? 'Guardar Cambios' : 'Crear Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pagar cuota modal */}
      {planParaPagar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-mist flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-green-600 rounded">
                  <Banknote className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-ink">Registrar Pago</h2>
                  <p className="text-xs text-slate2">{planParaPagar.detalle}</p>
                </div>
              </div>
              <button onClick={() => setPlanParaPagar(null)} className="text-slate2 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Importe */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-green-800 uppercase tracking-wider">Cuota {planParaPagar.cuotasPagas + 1}</span>
                <span className="text-xl font-black text-green-700">
                  {formatearMoneda(planParaPagar.importeCuota, planParaPagar.moneda as Moneda)}
                </span>
              </div>

              {/* Forma de pago como opciones con saldo */}
              {(() => {
                const FORMAS: { codigo: FormaDePago; nombre: string }[] = [
                  { codigo: 'EFECTIVO', nombre: 'Efectivo' },
                  { codigo: 'DEBITO', nombre: 'Débito' },
                  { codigo: 'TRANSFERENCIA BANCO', nombre: 'Transferencia Banco' },
                  { codigo: 'MERCADO_PAGO', nombre: 'Mercado Pago' },
                  { codigo: 'TARJETA', nombre: 'Tarjeta de Crédito' },
                ];
                const formas = (finanzas.config?.formasDePago ?? []).filter((f) => f.activa).length > 0
                  ? (finanzas.config!.formasDePago.filter((f) => f.activa).map((f) => ({ codigo: f.codigo as FormaDePago, nombre: f.nombre })))
                  : FORMAS;

                return (
                  <div>
                    <p className="text-xs font-bold text-slate2 uppercase tracking-wider mb-3">Forma de pago</p>
                    <div className="space-y-2">
                      {formas.map((f) => {
                        const esTarjeta = f.codigo === 'TARJETA';
                        const esMercadoPago = f.codigo === 'MERCADO_PAGO';
                        let cuenta = null;
                        let tarjeta = null;
                        let saldoLabel = '';

                        if (esTarjeta) {
                          tarjeta = finanzas.tarjetas?.find((t) => {
                            const n = (t.nombre ?? '').toLowerCase();
                            return n.includes('santander') && (n.includes('río') || n.includes('rio'));
                          });
                          saldoLabel = tarjeta?.nombre ?? 'Santander Río';
                        } else if (esMercadoPago) {
                          cuenta = finanzas.cuentas
                            .filter((c) => c.activa && c.moneda === 'ARS' && c.nombre.toLowerCase().includes('mercado'))
                            .sort((a, b) => b.saldoActual - a.saldoActual)[0] ?? null;
                          saldoLabel = cuenta ? formatearMoneda(cuenta.saldoActual) : '';
                        } else {
                          cuenta = finanzas.cuentas
                            .filter((c) => c.activa && c.moneda === 'ARS' && !c.nombre.toLowerCase().includes('mercado'))
                            .find((c) => f.codigo === 'EFECTIVO' ? c.tipo === 'EFECTIVO' : c.tipo !== 'EFECTIVO') ?? null;
                          saldoLabel = cuenta ? formatearMoneda(cuenta.saldoActual) : '';
                        }

                        const isSelected = pagoFormaPago === f.codigo;
                        return (
                          <button
                            key={f.codigo}
                            type="button"
                            onClick={() => {
                              setPagoFormaPago(f.codigo);
                              if (esTarjeta && tarjeta) setPagoTarjetaId(tarjeta.id);
                              else if (!esTarjeta && cuenta) setPagoCuentaId(cuenta.id);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                              isSelected ? 'border-green-500 bg-green-50' : 'border-mist bg-white hover:border-slate2/40'
                            }`}
                          >
                            <span className={`text-sm font-bold ${isSelected ? 'text-green-700' : 'text-ink'}`}>{f.nombre}</span>
                            {saldoLabel && (
                              <span className={`text-xs font-semibold ${isSelected ? 'text-green-600' : 'text-slate2'}`}>{saldoLabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setPlanParaPagar(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handlePagarPlan}
                  disabled={pagoGuardando}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {pagoGuardando ? 'Guardando...' : 'Confirmar Pago'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cuotas modal */}
      {planParaCuotas && (
        <GestionCuotasPlan plan={planParaCuotas} onClose={() => setPlanParaCuotas(null)} />
      )}

      {/* Confirm marcar pagada modal */}
      {planParaMarcarPagado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-mist flex items-center gap-3">
              <div className="p-1.5 bg-green-600 rounded">
                <Check className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-ink">Marcar Cuota como Pagada</h2>
            </div>
            <div className="p-6 text-center">
              <p className="text-slate2 mb-2">
                ¿Confirmás que querés marcar una cuota del plan como pagada?
              </p>
              <p className="text-xl font-black text-green-700 mb-6">{planParaMarcarPagado.detalle}</p>
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-6 flex gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium">
                  Esto{' '}
                  <span className="font-bold underline">aumentará la cantidad de cuotas pagas</span> y pateará
                  el vencimiento hacia el próximo mes, pero{' '}
                  <strong>NO registrará ningún movimiento en gastos diarios.</strong>
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPlanParaMarcarPagado(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={() => marcarCuotaPagada(planParaMarcarPagado)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Confirmar Pago
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
