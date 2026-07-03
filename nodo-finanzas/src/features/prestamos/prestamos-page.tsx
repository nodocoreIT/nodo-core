import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Search,
  X,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { FormSelect } from '@nodocore/shared-components';
import { Spinner } from '@/components/ui/spinner';
import { useLocation } from 'react-router-dom';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { formatearMoneda, formatearFecha, getFechaHoy } from '@/utils/formatters';
import { GestionCuotasProgramadas } from './gestion-cuotas-programadas';
import { ModalComprobantes } from './modal-comprobantes';
import toast from 'react-hot-toast';
import type { Prestamo, Moneda } from '@/types';

function proximaFechaDesdiaDia(dia: number): { iso: string; display: string } {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = hoy.getMonth() + 1;
  const maxDayActual = new Date(year, month, 0).getDate();
  const dayActual = Math.min(dia, maxDayActual);
  const fechaActual = new Date(year, month - 1, dayActual);

  const hoyMedianoche = new Date(year, hoy.getMonth(), hoy.getDate());
  if (fechaActual >= hoyMedianoche) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(dayActual).padStart(2, '0')}`;
    return { iso, display: `${String(dayActual).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const maxDayNext = new Date(nextYear, nextMonth, 0).getDate();
  const dayNext = Math.min(dia, maxDayNext);
  const iso = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dayNext).padStart(2, '0')}`;
  return { iso, display: `${String(dayNext).padStart(2, '0')}/${String(nextMonth).padStart(2, '0')}/${nextYear}` };
}

function avanzarMes(fechaISO: string, diaPago: number): string {
  const [year, month] = fechaISO.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const maxDay = new Date(nextYear, nextMonth, 0).getDate();
  const day = Math.min(diaPago, maxDay);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function retrocederMes(fechaISO: string, diaPago: number): string {
  const [year, month] = fechaISO.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const maxDay = new Date(prevYear, prevMonth, 0).getDate();
  const day = Math.min(diaPago, maxDay);
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface FormState {
  concepto: string;
  montoOriginal: string;
  moneda: Moneda;
  saldoPendiente: string;
  tasaInteres: string;
  fechaInicio: string;
  fechaVencimiento: string;
  cuotasTotales: string;
  cuotasPagas: string;
  importeCuota: string;
  saldoCancelacion: string;
  prestamista: string;
  notas: string;
  pagado: boolean;
  cuotaAbonada: boolean;
  noCobrarCuota: boolean;
  esSalvataje: boolean;
  diaPago: string;
}

const defaultForm = (): FormState => ({
  concepto: '',
  montoOriginal: '',
  moneda: 'ARS',
  saldoPendiente: '',
  tasaInteres: '',
  fechaInicio: getFechaHoy(),
  fechaVencimiento: '',
  cuotasTotales: '',
  cuotasPagas: '0',
  importeCuota: '',
  saldoCancelacion: '',
  prestamista: '',
  notas: '',
  pagado: false,
  cuotaAbonada: false,
  noCobrarCuota: false,
  esSalvataje: false,
  diaPago: '',
});

export function PrestamosPage() {
  const finanzas = useFinanzas();
  const { rubrosActivos } = useRubros();
  const location = useLocation();
  const mesActual = new Date().toISOString().slice(0, 7);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prestamoEditando, setPrestamoEditando] = useState<Prestamo | null>(null);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [prestamoParaCuotas, setPrestamoParaCuotas] = useState<Prestamo | null>(null);
  const [prestamoParaComprobantes, setPrestamoParaComprobantes] = useState<Prestamo | null>(null);
  const [prestamoParaPago, setPrestamoParaPago] = useState<Prestamo | null>(null);
  const [cuentaPagoId, setCuentaPagoId] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<FormState>(defaultForm());
  const [guardando, setGuardando] = useState(false);

  const openId = (location.state as { openId?: string } | null)?.openId;

  const abrirFormulario = (prestamo?: Prestamo) => {
    if (prestamo) {
      setPrestamoEditando(prestamo);
      setForm({
        concepto: prestamo.concepto,
        montoOriginal: String(prestamo.montoOriginal),
        moneda: prestamo.moneda,
        saldoPendiente: String(prestamo.saldoPendiente),
        tasaInteres: prestamo.tasaInteres ? String(prestamo.tasaInteres) : '',
        fechaInicio: prestamo.fechaInicio,
        fechaVencimiento: prestamo.fechaVencimiento || '',
        cuotasTotales: prestamo.cuotasTotales ? String(prestamo.cuotasTotales) : '',
        cuotasPagas: prestamo.cuotasPagas != null ? String(prestamo.cuotasPagas) : '0',
        importeCuota: prestamo.importeCuota ? String(prestamo.importeCuota) : '',
        saldoCancelacion: prestamo.saldoCancelacion ? String(prestamo.saldoCancelacion) : '',
        prestamista: prestamo.prestamista || '',
        notas: prestamo.notas || '',
        pagado: prestamo.pagado || false,
        cuotaAbonada: prestamo.cuotaAbonada || false,
        noCobrarCuota: prestamo.noCobrarCuota || false,
        esSalvataje: !prestamo.cuotasTotales,
        diaPago: prestamo.diaPago ? String(prestamo.diaPago) : '',
      });
    } else {
      setPrestamoEditando(null);
      setForm(defaultForm());
    }
    setMostrarFormulario(true);
  };

  useEffect(() => {
    if (!openId || finanzas.loading) return;
    const prestamo = finanzas.prestamos.find((p) => p.id === openId);
    if (prestamo) abrirFormulario(prestamo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, finanzas.loading]);

  if (finanzas.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-paper z-50">
        <Spinner />
      </div>
    );
  }

  const prestamos = finanzas.prestamos || [];
  const prestamosActivos = prestamos.filter((p) => p.activo && !p.pagado);
  const prestamosFinalizados = prestamos.filter((p) => !p.activo || p.pagado);
  const prestamosBase = mostrarFinalizados ? prestamosFinalizados : prestamosActivos;
  const prestamosMostrar = prestamosBase.filter(
    (p) =>
      p.concepto.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.prestamista || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const totales = prestamos
    .filter((p) => p.activo && !p.pagado)
    .reduce(
      (acc, p) => {
        if (p.moneda === 'USD') acc.USD += p.saldoPendiente;
        else acc.ARS += p.saldoPendiente;
        return acc;
      },
      { ARS: 0, USD: 0 }
    );

  const toggleExpansion = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setPrestamoEditando(null);
    setForm(defaultForm());
  };

  const handleDesmarcarCuota = async (prestamo: Prestamo) => {
    const cuotasPagasActual = prestamo.cuotasPagas ?? 0;
    const cambios: Partial<Prestamo> = {
      cuotaAbonada: false,
      cuotasPagas: Math.max(0, cuotasPagasActual - 1),
      ultimoPagoMes: undefined,
    };
    if (prestamo.diaPago && prestamo.fechaVencimiento) {
      cambios.fechaVencimiento = retrocederMes(prestamo.fechaVencimiento, prestamo.diaPago);
    }
    if (prestamo.importeCuota) {
      cambios.saldoPendiente = prestamo.saldoPendiente + prestamo.importeCuota;
    }
    try {
      await finanzas.actualizarPrestamo(prestamo.id, cambios);
      toast.success('Pago desmarcado');
    } catch {
      toast.error('Error al actualizar el préstamo');
    }
  };

  const handleConfirmarPago = async () => {
    if (!prestamoParaPago || !cuentaPagoId) return;
    const cuenta = finanzas.cuentas.find((c) => c.id === cuentaPagoId);
    if (!cuenta) return;

    const cuotasPagasActual = prestamoParaPago.cuotasPagas ?? 0;
    const numeroCuota = cuotasPagasActual + 1;

    let formaPago: import('@/types').FormaDePago = 'TRANSFERENCIA BANCO';
    if (cuenta.tipo === 'EFECTIVO') formaPago = 'EFECTIVO';
    else if (cuenta.tipo === 'VIRTUAL') formaPago = 'MERCADO_PAGO';

    setProcesandoPago(true);
    const rubroCreditos = rubrosActivos.find((r) => r.codigo === 'CREDITOS');

    try {
      await finanzas.agregarGastoDiario({
        descripcion: 'Préstamo',
        detalle: `${prestamoParaPago.concepto} - Cuota ${numeroCuota} de ${prestamoParaPago.cuotasTotales ?? '?'}`,
        monto: prestamoParaPago.importeCuota || 0,
        fecha: getFechaHoy(),
        formaPago,
        cuentaId: cuentaPagoId,
        prestamoId: prestamoParaPago.id,
        rubroId: rubroCreditos?.id,
        rubro: rubroCreditos ? 'CREDITOS' : undefined,
      });

      const cambios: Partial<Prestamo> = {
        cuotaAbonada: true,
        cuotasPagas: numeroCuota,
        ultimoPagoMes: mesActual,
      };
      if (prestamoParaPago.diaPago && prestamoParaPago.fechaVencimiento) {
        cambios.fechaVencimiento = avanzarMes(prestamoParaPago.fechaVencimiento, prestamoParaPago.diaPago);
      }
      if (prestamoParaPago.importeCuota) {
        cambios.saldoPendiente = Math.max(0, prestamoParaPago.saldoPendiente - prestamoParaPago.importeCuota);
      }

      await finanzas.actualizarPrestamo(prestamoParaPago.id, cambios);
      toast.success('Cuota registrada como pagada');
      setPrestamoParaPago(null);
      setCuentaPagoId('');
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setProcesandoPago(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const cuotasPagasNum = form.esSalvataje ? undefined : (form.cuotasPagas ? parseInt(form.cuotasPagas) : 0);
      const cuotasTotalesNum = form.esSalvataje ? undefined : (form.cuotasTotales ? parseInt(form.cuotasTotales) : undefined);

      // If cuotas paid < total, the loan is no longer complete — override pagado/activo
      // regardless of what the checkboxes say. Prevents accidental "finalizado" state.
      const cuotasComplete =
        cuotasTotalesNum !== undefined &&
        cuotasPagasNum !== undefined &&
        cuotasPagasNum >= cuotasTotalesNum;
      const pagado = cuotasTotalesNum !== undefined ? (form.pagado && cuotasComplete) : form.pagado;
      const activo = pagado ? (prestamoEditando?.activo ?? true) : true;

      const datos = {
        concepto: form.concepto,
        montoOriginal: parseFloat(form.montoOriginal) || 0,
        moneda: form.moneda,
        saldoPendiente: parseFloat(form.saldoPendiente) || 0,
        tasaInteres: form.tasaInteres ? parseFloat(form.tasaInteres) : undefined,
        fechaInicio: form.fechaInicio,
        fechaVencimiento: form.esSalvataje ? undefined : (form.fechaVencimiento || undefined),
        cuotasTotales: cuotasTotalesNum,
        cuotasPagas: cuotasPagasNum,
        importeCuota: form.esSalvataje ? undefined : (form.importeCuota ? parseFloat(form.importeCuota) : undefined),
        saldoCancelacion: form.esSalvataje ? undefined : (form.saldoCancelacion ? parseFloat(form.saldoCancelacion) : undefined),
        prestamista: form.prestamista || undefined,
        notas: form.notas || undefined,
        pagado,
        activo,
        cuotaAbonada: form.cuotaAbonada,
        noCobrarCuota: form.noCobrarCuota,
        diaPago: form.diaPago ? parseInt(form.diaPago) : undefined,
      };

      if (prestamoEditando) {
        await finanzas.actualizarPrestamo(prestamoEditando.id, datos);
        toast.success('Préstamo actualizado');
      } else {
        await finanzas.agregarPrestamo({ ...datos, activo: true } as Omit<Prestamo, 'id'>);
        toast.success('Préstamo creado');
      }
      cerrarFormulario();
    } catch {
      toast.error('Error al guardar el préstamo');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!window.confirm('¿Eliminar este préstamo?')) return;
    try {
      await finanzas.eliminarPrestamo(id);
      toast.success('Préstamo eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const calcularProgreso = (p: Prestamo) => {
    if (!p.montoOriginal) return 0;
    return ((p.montoOriginal - p.saldoPendiente) / p.montoOriginal) * 100;
  };

  const calcularDiasRestantes = (fechaVenc?: string) => {
    if (!fechaVenc) return null;
    const diff = new Date(fechaVenc).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingDown className="w-8 h-8 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Préstamos</h1>
            <p className="text-slate2">Administrá tus préstamos y cuotas</p>
          </div>
        </div>
        <Button onClick={() => abrirFormulario()}>
          <Plus className="w-4 h-4" />
          Nuevo Préstamo
        </Button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-mist p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate2">Saldo pendiente ARS</p>
              <p className="text-xl font-bold text-red-600">{formatearMoneda(totales.ARS)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-mist p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate2">Saldo pendiente USD</p>
              <p className="text-xl font-bold text-blue-600">
                US$ {totales.USD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-2">
          <Button
            variant={!mostrarFinalizados ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMostrarFinalizados(false)}
          >
            Activos ({prestamosActivos.length})
          </Button>
          <Button
            variant={mostrarFinalizados ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMostrarFinalizados(true)}
          >
            Finalizados ({prestamosFinalizados.length})
          </Button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate2" />
          <input
            type="text"
            placeholder="Buscar préstamo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-white pl-9 pr-8 py-2 border border-mist rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate2">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-mist">
        <div className="p-5">
          {prestamosMostrar.length === 0 ? (
            <div className="text-center py-10">
              <TrendingDown className="w-12 h-12 text-slate2 mx-auto mb-3" />
              <p className="text-slate2">
                {mostrarFinalizados ? 'No hay préstamos finalizados' : 'No hay préstamos activos'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {prestamosMostrar.map((prestamo) => {
                const progreso = calcularProgreso(prestamo);
                const diasRestantes = calcularDiasRestantes(prestamo.fechaVencimiento);
                const vencido = diasRestantes !== null && diasRestantes < 0;
                const proximoVencimiento = diasRestantes !== null && diasRestantes <= 30 && diasRestantes >= 0;
                const estaPagadoEsteMes =
                  prestamo.pagado || prestamo.cuotaAbonada || prestamo.ultimoPagoMes === mesActual;
                const cuotasPagadas =
                  prestamo.cuotasPagas != null
                    ? prestamo.cuotasPagas
                    : prestamo.importeCuota
                    ? Math.round((prestamo.montoOriginal - prestamo.saldoPendiente) / prestamo.importeCuota)
                    : 0;

                return (
                  <div
                    key={prestamo.id}
                    className="p-4 rounded-xl border border-mist bg-white hover:border-brand/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: title + badges */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-ink leading-tight">{prestamo.concepto}</h3>
                        {prestamo.prestamista && (
                          <p className="text-xs text-slate2 mt-0.5">{prestamo.prestamista}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {!prestamo.cuotasTotales && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
                              Salvataje
                            </span>
                          )}
                          {estaPagadoEsteMes && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                              ✓ {prestamo.pagado ? 'Pagado' : 'Mes Abonado'}
                            </span>
                          )}
                          {vencido && !estaPagadoEsteMes && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Vencido
                            </span>
                          )}
                          {proximoVencimiento && !estaPagadoEsteMes && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Vence pronto
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Center: compact stats */}
                      <div className="flex items-start justify-around flex-1">
                        <div>
                          <p className="text-[10px] text-slate2 uppercase font-bold mb-0.5">Cuota</p>
                          <p className="font-bold text-ink text-sm">
                            {prestamo.cuotasTotales
                              ? formatearMoneda(prestamo.importeCuota || 0, prestamo.moneda as Moneda)
                              : <span className="text-slate2 font-normal">—</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate2 uppercase font-bold mb-0.5">Saldo</p>
                          <p className="font-bold text-red-600 text-sm">
                            {formatearMoneda(prestamo.saldoPendiente, prestamo.moneda as Moneda)}
                          </p>
                        </div>
                        {prestamo.cuotasTotales && (
                          <div>
                            <p className="text-[10px] text-slate2 uppercase font-bold mb-0.5">Cuotas</p>
                            <p className="font-medium text-ink text-sm">{cuotasPagadas}/{prestamo.cuotasTotales}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-slate2 uppercase font-bold mb-0.5">Vto.</p>
                          <p className="font-medium text-ink text-sm">
                            {prestamo.fechaVencimiento ? formatearFecha(prestamo.fechaVencimiento) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Right: buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {prestamo.cuotasTotales && !prestamo.pagado && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs font-bold ${
                              prestamo.cuotaAbonada
                                ? 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            onClick={() => {
                              if (prestamo.cuotaAbonada) {
                                handleDesmarcarCuota(prestamo);
                              } else {
                                const cuentasCompatibles = finanzas.cuentas.filter(
                                  (c) => c.activa && c.moneda === prestamo.moneda
                                );
                                setCuentaPagoId(cuentasCompatibles[0]?.id || '');
                                setPrestamoParaPago(prestamo);
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {prestamo.cuotaAbonada ? 'Desmarcar pago' : 'Pagar cuota'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-bold"
                          onClick={() => setPrestamoParaCuotas(prestamo)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ver Cuotas
                        </Button>
                        <button
                          onClick={() => setPrestamoParaComprobantes(prestamo)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Comprobantes"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => abrirFormulario(prestamo)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEliminar(prestamo.id)}
                          className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandible details */}
                    {prestamo.cuotasTotales && (
                      <>
                        <button
                          onClick={() => toggleExpansion(prestamo.id)}
                          className="mt-3 flex items-center gap-1 text-sm text-brand hover:text-brand-dark transition-colors"
                        >
                          <span>{expandidos.has(prestamo.id) ? 'Menos detalles' : 'Más detalles'}</span>
                          {expandidos.has(prestamo.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {expandidos.has(prestamo.id) && (
                          <div className="mt-4 pt-4 border-t border-mist space-y-3">
                            {/* Progress bar */}
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate2">Progreso de pago</span>
                                <span className="font-medium text-ink">{progreso.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-mist">
                                <div
                                  className="h-2 rounded-full bg-brand"
                                  style={{ width: `${Math.min(progreso, 100)}%` }}
                                />
                              </div>
                            </div>
                            {/* Saldo cancelación */}
                            {prestamo.saldoCancelacion && prestamo.saldoCancelacion > 0 && (
                              <div className="bg-indigo-50 rounded-lg p-3 text-sm">
                                <p className="text-xs text-indigo-600 font-bold uppercase mb-1">Cancelación Total</p>
                                <p className="font-bold text-indigo-700">
                                  {formatearMoneda(prestamo.saldoCancelacion, prestamo.moneda as Moneda)}
                                </p>
                              </div>
                            )}
                            {prestamo.notas && (
                              <div className="bg-paper rounded-lg p-3 text-sm text-slate2">
                                {prestamo.notas}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: selección de cuenta para pagar cuota */}
      {prestamoParaPago && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-ink">Pagar cuota</h3>
            <div className="bg-mist/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold text-ink">{prestamoParaPago.concepto}</p>
              <p className="text-xs text-slate2">
                Cuota {(prestamoParaPago.cuotasPagas ?? 0) + 1} de {prestamoParaPago.cuotasTotales ?? '?'}
                {prestamoParaPago.importeCuota
                  ? ` — ${formatearMoneda(prestamoParaPago.importeCuota, prestamoParaPago.moneda as Moneda)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">¿Desde qué cuenta realizás el pago?</label>
              <select
                value={cuentaPagoId}
                onChange={(e) => setCuentaPagoId(e.target.value)}
                className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="">Seleccioná una cuenta</option>
                {finanzas.cuentas
                  .filter((c) => c.activa && c.moneda === prestamoParaPago.moneda)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} — {formatearMoneda(c.saldoActual, c.moneda)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setPrestamoParaPago(null); setCuentaPagoId(''); }}
                disabled={procesandoPago}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmarPago}
                disabled={!cuentaPagoId || procesandoPago}
              >
                {procesandoPago ? 'Registrando...' : 'Confirmar pago'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario modal */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-mist">
              <h3 className="text-lg font-bold text-ink">
                {prestamoEditando ? 'Editar Préstamo' : 'Nuevo Préstamo'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Concepto *</label>
                  <input
                    type="text"
                    value={form.concepto}
                    onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
                    placeholder="Ej: Préstamo personal, Inversión..."
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>

                <MoneyInput
                  label="Monto Original *"
                  value={parseFloat(form.montoOriginal) || 0}
                  onChange={(v) => setForm((f) => ({ ...f, montoOriginal: v ? String(v) : '' }))}
                  moneda={form.moneda}
                  required
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Moneda</label>
                  <FormSelect
                    value={form.moneda}
                    onChange={(value) => setForm((current) => ({ ...current, moneda: value as Moneda }))}
                    options={[
                      { value: 'ARS', label: 'Pesos (ARS)' },
                      { value: 'USD', label: 'Dólares (USD)' },
                    ]}
                  />
                </div>

                <MoneyInput
                  label="Saldo Pendiente"
                  value={parseFloat(form.saldoPendiente) || 0}
                  onChange={(v) => setForm((f) => ({ ...f, saldoPendiente: v ? String(v) : '' }))}
                  moneda={form.moneda}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Fecha Inicio *</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.esSalvataje}
                      onChange={(e) => setForm((f) => ({ ...f, esSalvataje: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-brand border-mist rounded"
                    />
                    <div>
                      <span className="text-sm font-semibold text-ink">Salvataje familiar / Sin compromiso de pago</span>
                      <p className="text-xs text-slate2 mt-0.5">Ayuda familiar o préstamo sin cuotas ni vencimientos fijos.</p>
                    </div>
                  </label>
                </div>

                {!form.esSalvataje && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Día de vencimiento</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        value={form.diaPago}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          const diaNum = parseInt(val);
                          let nuevaFecha = form.fechaVencimiento;
                          if (val && diaNum >= 1 && diaNum <= 31) {
                            nuevaFecha = proximaFechaDesdiaDia(diaNum).iso;
                          }
                          setForm((f) => ({ ...f, diaPago: val, fechaVencimiento: nuevaFecha }));
                        }}
                        placeholder="Ej: 15"
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      {(() => {
                        const diaNum = parseInt(form.diaPago);
                        if (!form.diaPago || diaNum < 1 || diaNum > 31) return null;
                        const { display } = proximaFechaDesdiaDia(diaNum);
                        return (
                          <p className="text-xs text-brand font-medium">
                            Próximo vencimiento: {display}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Cuotas Totales</label>
                      <input
                        type="number"
                        min="1"
                        value={form.cuotasTotales}
                        onChange={(e) => setForm((f) => ({ ...f, cuotasTotales: e.target.value }))}
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Cuotas Pagadas</label>
                      <input
                        type="number"
                        min="0"
                        value={form.cuotasPagas}
                        onChange={(e) => setForm((f) => ({ ...f, cuotasPagas: e.target.value }))}
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <MoneyInput
                      label="Importe Cuota"
                      value={parseFloat(form.importeCuota) || 0}
                      onChange={(v) => setForm((f) => ({ ...f, importeCuota: v ? String(v) : '' }))}
                      moneda={form.moneda}
                    />
                    <MoneyInput
                      label="Saldo Cancelación"
                      value={parseFloat(form.saldoCancelacion) || 0}
                      onChange={(v) => setForm((f) => ({ ...f, saldoCancelacion: v ? String(v) : '' }))}
                      moneda={form.moneda}
                    />
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Prestamista</label>
                  <input
                    type="text"
                    value={form.prestamista}
                    onChange={(e) => setForm((f) => ({ ...f, prestamista: e.target.value }))}
                    placeholder="Nombre o institución (opcional)"
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Tasa de interés (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.tasaInteres}
                    onChange={(e) => setForm((f) => ({ ...f, tasaInteres: e.target.value }))}
                    placeholder="Ej: 109.16"
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                    rows={2}
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                    placeholder="Notas adicionales..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pagado"
                    checked={form.pagado}
                    onChange={(e) => setForm((f) => ({ ...f, pagado: e.target.checked }))}
                    className="w-4 h-4 text-brand border-mist rounded"
                  />
                  <label htmlFor="pagado" className="text-sm font-medium text-ink">Préstamo pagado completamente</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cuotaAbonada"
                    checked={form.cuotaAbonada}
                    onChange={(e) => setForm((f) => ({ ...f, cuotaAbonada: e.target.checked }))}
                    className="w-4 h-4 text-brand border-mist rounded"
                  />
                  <label htmlFor="cuotaAbonada" className="text-sm font-medium text-ink">Cuota del mes abonada</label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={cerrarFormulario} className="flex-1" disabled={guardando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando} className="flex-1">
                  {guardando ? 'Guardando...' : prestamoEditando ? 'Actualizar' : 'Crear Préstamo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {prestamoParaCuotas && (
        <GestionCuotasProgramadas
          prestamo={prestamoParaCuotas}
          onClose={() => setPrestamoParaCuotas(null)}
        />
      )}

      {prestamoParaComprobantes && (
        <ModalComprobantes
          prestamo={prestamoParaComprobantes}
          onClose={() => setPrestamoParaComprobantes(null)}
        />
      )}
    </div>
  );
}
