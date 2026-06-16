import React, { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFinanzas } from '@/hooks/use-finanzas';
import { formatearMoneda, formatearFecha, getFechaHoy } from '@/utils/formatters';
import { GestionCuotasProgramadas } from './gestion-cuotas-programadas';
import toast from 'react-hot-toast';
import type { Prestamo, Moneda } from '@/types';

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
});

export function PrestamosPage() {
  const finanzas = useFinanzas();
  const mesActual = new Date().toISOString().slice(0, 7);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [prestamoEditando, setPrestamoEditando] = useState<Prestamo | null>(null);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [prestamoParaCuotas, setPrestamoParaCuotas] = useState<Prestamo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<FormState>(defaultForm());
  const [guardando, setGuardando] = useState(false);

  if (finanzas.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-paper z-50">
        <Spinner label="Cargando préstamos..." />
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
      });
    } else {
      setPrestamoEditando(null);
      setForm(defaultForm());
    }
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setPrestamoEditando(null);
    setForm(defaultForm());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const datos = {
        concepto: form.concepto,
        montoOriginal: parseFloat(form.montoOriginal) || 0,
        moneda: form.moneda,
        saldoPendiente: parseFloat(form.saldoPendiente) || 0,
        tasaInteres: form.tasaInteres ? parseFloat(form.tasaInteres) : undefined,
        fechaInicio: form.fechaInicio,
        fechaVencimiento: form.esSalvataje ? undefined : (form.fechaVencimiento || undefined),
        cuotasTotales: form.esSalvataje ? undefined : (form.cuotasTotales ? parseInt(form.cuotasTotales) : undefined),
        cuotasPagas: form.esSalvataje ? undefined : (form.cuotasPagas ? parseInt(form.cuotasPagas) : 0),
        importeCuota: form.esSalvataje ? undefined : (form.importeCuota ? parseFloat(form.importeCuota) : undefined),
        saldoCancelacion: form.esSalvataje ? undefined : (form.saldoCancelacion ? parseFloat(form.saldoCancelacion) : undefined),
        prestamista: form.prestamista || undefined,
        notas: form.notas || undefined,
        pagado: form.pagado,
        cuotaAbonada: form.cuotaAbonada,
        noCobrarCuota: form.noCobrarCuota,
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
            className="w-full pl-9 pr-8 py-2 border border-mist rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
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
          <h2 className="text-base font-semibold text-ink mb-4">
            {mostrarFinalizados ? 'Finalizados' : 'Activos'} ({prestamosMostrar.length})
          </h2>

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
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="font-bold text-lg text-ink">{prestamo.concepto}</h3>
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

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate2 uppercase font-bold mb-1">Valor Cuota</p>
                            <p className="font-bold text-ink">
                              {prestamo.cuotasTotales
                                ? formatearMoneda(prestamo.importeCuota || 0, prestamo.moneda as Moneda)
                                : <span className="text-slate2 font-normal">Sin cuota</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate2 uppercase font-bold mb-1">Saldo Pendiente</p>
                            <p className="font-bold text-red-600">
                              {formatearMoneda(prestamo.saldoPendiente, prestamo.moneda as Moneda)}
                            </p>
                          </div>
                          {prestamo.cuotasTotales && (
                            <div>
                              <p className="text-xs text-slate2 uppercase font-bold mb-1">Cuotas</p>
                              <p className="font-medium text-ink">
                                {cuotasPagadas} / {prestamo.cuotasTotales}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-slate2 uppercase font-bold mb-1">Vencimiento</p>
                            <p className="font-medium text-ink">
                              {prestamo.fechaVencimiento
                                ? formatearFecha(prestamo.fechaVencimiento)
                                : 'Flexible'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 lg:flex-col justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-bold"
                          onClick={() => setPrestamoParaCuotas(prestamo)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ver Cuotas
                        </Button>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirFormulario(prestamo)}
                            className="h-8 w-8 p-0 border-brand/20 bg-brand/5 text-brand"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEliminar(prestamo.id)}
                            className="h-8 w-8 p-0 border-red-200 bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Monto Original *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.montoOriginal}
                    onChange={(e) => setForm((f) => ({ ...f, montoOriginal: e.target.value }))}
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Moneda</label>
                  <select
                    value={form.moneda}
                    onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value as Moneda }))}
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink">Saldo Pendiente</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.saldoPendiente}
                    onChange={(e) => setForm((f) => ({ ...f, saldoPendiente: e.target.value }))}
                    className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
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
                      <label className="text-sm font-medium text-ink">Fecha Vencimiento</label>
                      <input
                        type="date"
                        value={form.fechaVencimiento}
                        onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
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
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Importe Cuota</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.importeCuota}
                        onChange={(e) => setForm((f) => ({ ...f, importeCuota: e.target.value }))}
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Saldo Cancelación</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.saldoCancelacion}
                        onChange={(e) => setForm((f) => ({ ...f, saldoCancelacion: e.target.value }))}
                        className="border border-mist rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
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
    </div>
  );
}
