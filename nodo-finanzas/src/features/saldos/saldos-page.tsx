// @ts-nocheck
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, PiggyBank, History, ArrowLeftRight, ArrowRight, X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Spinner } from '@/components/ui/spinner';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useDolar } from '@/hooks/use-dolar';
import { formatearMoneda, formatearFecha, obtenerFechaActual } from '@/utils/formatters';
import { cuentaPillClass } from '@/utils/cuenta-colors';
import { FinanzasService } from '@/services/finanzas-service';
import { VoiceTransferButton } from '@/features/saldos/components/voice-transfer-button';
import type { Cuenta, Moneda, TipoCuenta, MovimientoCuenta } from '@/types';

// ── Schemas ──────────────────────────────────────────────────────────────────

const schemaCuenta = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo: z.enum(['EFECTIVO', 'CAJA_AHORRO', 'CUENTA_CORRIENTE', 'VIRTUAL']),
  saldoActual: z.number(),
  moneda: z.enum(['ARS', 'USD']),
});

const schemaTransferencia = z.object({
  cuentaOrigenId: z.string().min(1, 'Seleccioná una cuenta origen'),
  cuentaDestinoId: z.string().min(1, 'Seleccioná una cuenta destino'),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  descripcion: z.string().optional(),
});

type FormCuenta = z.infer<typeof schemaCuenta>;
type FormTransferencia = z.infer<typeof schemaTransferencia>;

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS_CUENTA = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CAJA_AHORRO', label: 'Caja de Ahorro' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta Corriente' },
  { value: 'VIRTUAL', label: 'Cuenta Virtual' },
];

const MONEDAS = [
  { value: 'ARS', label: 'Pesos Argentinos (ARS)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function tipoBadgeClass(tipo: TipoCuenta): string {
  const map: Record<TipoCuenta, string> = {
    EFECTIVO: 'bg-emerald-100 text-emerald-800',
    CAJA_AHORRO: 'bg-brand/10 text-brand',
    CUENTA_CORRIENTE: 'bg-slate-100 text-slate-700',
    VIRTUAL: 'bg-violet-100 text-violet-800',
  };
  return map[tipo] ?? 'bg-mist text-slate2';
}

function tipoLabel(tipo: TipoCuenta): string {
  const map: Record<TipoCuenta, string> = {
    EFECTIVO: 'Efectivo',
    CAJA_AHORRO: 'Caja de Ahorro',
    CUENTA_CORRIENTE: 'Cta. Corriente',
    VIRTUAL: 'Virtual',
  };
  return map[tipo] ?? tipo;
}

// ── MovimientosModal ──────────────────────────────────────────────────────────

const schemaMovimiento = z.object({
  tipo: z.enum(['entrada', 'salida']),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  fecha: z.string().min(1),
  detalle: z.string().optional(),
});
type FormMovimiento = z.infer<typeof schemaMovimiento>;

interface MovimientosModalProps {
  cuenta: Cuenta;
  onClose: () => void;
  finanzas: ReturnType<typeof useFinanzas>;
}

function MovimientosModal({ cuenta, onClose, finanzas }: MovimientosModalProps) {
  const [movimientos, setMovimientos] = useState<MovimientoCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'lista' | 'form'>('lista');
  const [editando, setEditando] = useState<MovimientoCuenta | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'salida'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [sortField, setSortField] = useState<'fecha' | 'descripcion' | 'monto' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [mesFiltro, setMesFiltro] = useState<{ year: number; month: number } | null>(() => {
    const hoy = new Date();
    return { year: hoy.getFullYear(), month: hoy.getMonth() };
  });

  function toggleSort(field: 'fecha' | 'descripcion' | 'monto') {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function prevMes() {
    setMesFiltro((prev) => {
      if (!prev) return prev;
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function nextMes() {
    setMesFiltro((prev) => {
      if (!prev) return prev;
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const mesLabel = mesFiltro
    ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
        .format(new Date(mesFiltro.year, mesFiltro.month))
        .replace(/^\w/, (c) => c.toUpperCase())
    : '';

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormMovimiento>({
    resolver: zodResolver(schemaMovimiento),
    defaultValues: {
      tipo: 'salida',
      monto: 0,
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      detalle: '',
    },
  });

  const tipoActual = watch('tipo');

  const cargarMovimientos = useCallback(() => {
    setLoading(true);
    FinanzasService.obtenerMovimientosCuenta(cuenta.id)
      .then((data) => setMovimientos(data))
      .catch(() => toast.error('Error al cargar movimientos'))
      .finally(() => setLoading(false));
  }, [cuenta.id]);

  useEffect(() => { cargarMovimientos(); }, [cargarMovimientos]);

  function abrirNuevo() {
    setEditando(null);
    reset({
      tipo: 'salida',
      monto: 0,
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      detalle: '',
    });
    setVista('form');
  }

  function abrirEdicion(m: MovimientoCuenta) {
    setEditando(m);
    reset({
      tipo: m.tipo,
      monto: Math.abs(m.monto),
      descripcion: m.descripcion,
      fecha: m.fecha,
      detalle: m.detalle ?? '',
    });
    setVista('form');
  }

  function volverALista() {
    setVista('lista');
    setEditando(null);
  }

  async function onSubmit(data: FormMovimiento) {
    try {
      if (editando) {
        await finanzas.actualizarMovimientoManual(
          editando.id,
          {
            tipo: data.tipo,
            monto: data.monto,
            descripcion: data.descripcion,
            fecha: data.fecha,
            detalle: data.detalle || undefined,
          },
          editando,
        );
        toast.success('Movimiento actualizado');
      } else {
        await finanzas.registrarMovimientoManual({
          cuentaId: cuenta.id,
          tipo: data.tipo,
          monto: data.monto,
          descripcion: data.descripcion,
          fecha: data.fecha,
          detalle: data.detalle || undefined,
          origen: 'ajuste_manual',
        });
        toast.success(data.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
      }
      cargarMovimientos();
      volverALista();
    } catch {
      toast.error('Error al guardar el movimiento');
    }
  }

  async function handleEliminar(m: MovimientoCuenta) {
    setEliminandoId(m.id);
    try {
      await finanzas.eliminarMovimientoManual(m);
      toast.success('Movimiento eliminado');
      cargarMovimientos();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setEliminandoId(null);
    }
  }

  const movimientosMes = useMemo(() => {
    if (!mesFiltro) return movimientos;
    const prefix = `${mesFiltro.year}-${String(mesFiltro.month + 1).padStart(2, '0')}`;
    return movimientos.filter((m) => m.fecha.startsWith(prefix));
  }, [movimientos, mesFiltro]);

  const totalEntradas = movimientosMes.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0);
  const totalSalidas = movimientosMes.filter((m) => m.tipo === 'salida').reduce((s, m) => s + m.monto, 0);

  const movimientosFiltrados = useMemo(() => {
    let list = filtroTipo === 'todos' ? movimientosMes : movimientosMes.filter((m) => m.tipo === filtroTipo);
    if (busqueda.trim()) {
      const t = busqueda.toLowerCase().trim();
      list = list.filter((m) =>
        m.descripcion.toLowerCase().includes(t) ||
        (m.detalle && m.detalle.toLowerCase().includes(t))
      );
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        if (sortField === 'fecha') {
          return sortDir === 'asc'
            ? a.fecha.localeCompare(b.fecha)
            : b.fecha.localeCompare(a.fecha);
        }
        if (sortField === 'descripcion') {
          return sortDir === 'asc'
            ? a.descripcion.localeCompare(b.descripcion)
            : b.descripcion.localeCompare(a.descripcion);
        }
        return sortDir === 'asc' ? a.monto - b.monto : b.monto - a.monto;
      });
    }
    return list;
  }, [movimientosMes, filtroTipo, busqueda, sortField, sortDir]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist flex-shrink-0">
          <div className="flex items-center gap-2">
            {vista === 'form' && (
              <button onClick={volverALista} className="p-1 hover:bg-mist rounded-lg text-slate2 mr-1">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h3 className="text-base font-bold text-ink">
                {vista === 'form' ? (editando ? 'Editar movimiento' : 'Nuevo movimiento') : 'Movimientos'}
              </h3>
              <p className="text-xs text-slate2">{cuenta.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {vista === 'lista' && (
              <button
                onClick={abrirNuevo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        {vista === 'form' && (
          <div className="overflow-y-auto flex-1 p-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Tipo toggle */}
              <div>
                <p className="text-sm font-medium text-ink mb-2">Tipo</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('tipo', 'entrada')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      tipoActual === 'entrada'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-mist text-slate2 hover:border-emerald-300'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('tipo', 'salida')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      tipoActual === 'salida'
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-mist text-slate2 hover:border-red-300'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Salida
                  </button>
                </div>
              </div>

              <Controller
                name="monto"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    label="Monto"
                    value={field.value}
                    onChange={field.onChange}
                    moneda={cuenta.moneda}
                    error={errors.monto?.message}
                    required
                  />
                )}
              />

              <Input
                label="Descripción"
                {...register('descripcion')}
                error={errors.descripcion?.message}
                placeholder="Ej: Sueldo, Retiro efectivo, Ajuste"
              />

              <Input
                label="Fecha"
                type="date"
                {...register('fecha')}
                error={errors.fecha?.message}
              />

              <Input
                label="Notas (opcional)"
                {...register('detalle')}
                placeholder="Detalle adicional"
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={volverALista} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  className={`flex-1 ${tipoActual === 'entrada' ? '!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600' : ''}`}
                >
                  {tipoActual === 'entrada' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {editando ? 'Actualizar' : tipoActual === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Lista */}
        {vista === 'lista' && (
          <>
            {/* Totales rápidos + filtro */}
            {movimientos.length > 0 && (
              <div className="px-5 py-3 border-b border-mist flex-shrink-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFiltroTipo((f) => f === 'entrada' ? 'todos' : 'entrada')}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors text-left ${filtroTipo === 'entrada' ? 'bg-emerald-100 ring-1 ring-emerald-400' : 'hover:bg-emerald-50'}`}
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate2 uppercase tracking-wider">Entradas</p>
                      <p className="text-sm font-bold text-emerald-600">{formatearMoneda(totalEntradas, cuenta.moneda)}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setFiltroTipo((f) => f === 'salida' ? 'todos' : 'salida')}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors text-left ${filtroTipo === 'salida' ? 'bg-red-100 ring-1 ring-red-400' : 'hover:bg-red-50'}`}
                  >
                    <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate2 uppercase tracking-wider">Salidas</p>
                      <p className="text-sm font-bold text-red-500">{formatearMoneda(totalSalidas, cuenta.moneda)}</p>
                    </div>
                  </button>
                </div>
                {filtroTipo !== 'todos' && (
                  <button
                    onClick={() => setFiltroTipo('todos')}
                    className="text-xs text-slate2 hover:text-ink underline underline-offset-2"
                  >
                    Ver todos los movimientos
                  </button>
                )}
              </div>
            )}

            {movimientos.length > 0 && (
              <div className="px-5 pt-3 pb-2 flex-shrink-0 space-y-2">
                {/* Search + month nav */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate2" />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar movimiento…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-mist rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div className="flex items-center flex-shrink-0 border border-mist rounded-lg overflow-hidden">
                    <button
                      onClick={prevMes}
                      disabled={!mesFiltro}
                      className="p-1.5 text-slate2 hover:text-ink hover:bg-mist disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-medium text-ink px-2 min-w-[80px] text-center">
                      {mesFiltro ? mesLabel : 'Todos'}
                    </span>
                    <button
                      onClick={nextMes}
                      disabled={!mesFiltro}
                      className="p-1.5 text-slate2 hover:text-ink hover:bg-mist disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Ver todo toggle */}
                <label className="flex items-center gap-2 text-xs text-slate2 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={mesFiltro === null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMesFiltro(null);
                      } else {
                        const hoy = new Date();
                        setMesFiltro({ year: hoy.getFullYear(), month: hoy.getMonth() });
                      }
                    }}
                    className="w-3.5 h-3.5 rounded text-brand border-mist focus:ring-brand"
                  />
                  Ver todos los movimientos
                </label>
              </div>
            )}

            {movimientos.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-2 border-b border-mist flex-shrink-0">
                <span className="w-7 flex-shrink-0" />
                <button
                  onClick={() => toggleSort('fecha')}
                  className={`w-20 flex-shrink-0 flex items-center gap-1 text-xs font-medium transition-colors text-left ${sortField === 'fecha' ? 'text-brand' : 'text-slate2 hover:text-ink'}`}
                >
                  Fecha
                  {sortField === 'fecha'
                    ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                </button>
                <button
                  onClick={() => toggleSort('descripcion')}
                  className={`flex-1 flex items-center gap-1 text-xs font-medium transition-colors text-left ${sortField === 'descripcion' ? 'text-brand' : 'text-slate2 hover:text-ink'}`}
                >
                  Descripción
                  {sortField === 'descripcion'
                    ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                </button>
                <button
                  onClick={() => toggleSort('monto')}
                  className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium transition-colors ${sortField === 'monto' ? 'text-brand' : 'text-slate2 hover:text-ink'}`}
                >
                  Importe
                  {sortField === 'monto'
                    ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                </button>
                <span className="w-11 flex-shrink-0" />
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-5">
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : movimientos.length === 0 ? (
                <div className="text-center py-10">
                  <History className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  <p className="text-sm text-slate2">Sin movimientos registrados</p>
                  <button
                    onClick={abrirNuevo}
                    className="mt-3 text-xs font-semibold text-brand hover:underline"
                  >
                    Agregar el primero
                  </button>
                </div>
              ) : movimientosFiltrados.length === 0 ? (
                <div className="text-center py-10">
                  <Search className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  <p className="text-sm text-slate2">Sin resultados para "{busqueda}"</p>
                  <button onClick={() => setBusqueda('')} className="mt-2 text-xs text-brand hover:underline">Limpiar búsqueda</button>
                </div>
              ) : (
                <div className="divide-y divide-mist/50">
                  {movimientosFiltrados.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2.5 group">
                      <div className={`flex-shrink-0 p-1.5 rounded-full ${m.tipo === 'entrada' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {m.tipo === 'entrada'
                          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        }
                      </div>
                      <span className="w-20 flex-shrink-0 text-xs text-slate2">{formatearFecha(m.fecha)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{m.descripcion}</p>
                        {m.detalle && <p className="text-xs text-slate2/70 truncate">{m.detalle}</p>}
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{formatearMoneda(Math.abs(m.monto), cuenta.moneda)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => abrirEdicion(m)}
                          className="p-1 text-slate2 hover:text-brand hover:bg-mist rounded transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEliminar(m)}
                          disabled={eliminandoId === m.id}
                          className="p-1 text-slate2 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SaldosPage() {
  const finanzas = useFinanzas();
  const dolar = useDolar();

  const [modalCuenta, setModalCuenta] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState<Cuenta | null>(null);
  const [cuentaMovimientos, setCuentaMovimientos] = useState<Cuenta | null>(null);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [cuentaAEliminar, setCuentaAEliminar] = useState<Cuenta | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // ── Cuenta form ────────────────────────────────────────────────────────────

  const {
    register: regCuenta,
    handleSubmit: handleCuenta,
    control: controlCuenta,
    reset: resetCuenta,
    watch: watchCuenta,
    formState: { errors: errCuenta, isSubmitting: submitingCuenta },
  } = useForm<FormCuenta>({
    resolver: zodResolver(schemaCuenta),
    defaultValues: { nombre: '', tipo: 'EFECTIVO', saldoActual: 0, moneda: 'ARS' },
  });

  const monedaCuenta = watchCuenta('moneda');

  function abrirModalCuenta(cuenta?: Cuenta) {
    if (cuenta) {
      setCuentaEditando(cuenta);
      resetCuenta({
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        saldoActual: cuenta.saldoActual,
        moneda: cuenta.moneda,
      });
    } else {
      setCuentaEditando(null);
      resetCuenta({ nombre: '', tipo: 'EFECTIVO', saldoActual: 0, moneda: 'ARS' });
    }
    setModalCuenta(true);
  }

  function cerrarModalCuenta() {
    setModalCuenta(false);
    setCuentaEditando(null);
    resetCuenta();
  }

  async function onSubmitCuenta(data: FormCuenta) {
    try {
      if (cuentaEditando) {
        await finanzas.actualizarCuenta(cuentaEditando.id, {
          ...data,
          fechaActualizacion: obtenerFechaActual('iso'),
        });
        toast.success('Cuenta actualizada');
      } else {
        await finanzas.agregarCuenta({
          ...data,
          activa: true,
          fechaActualizacion: obtenerFechaActual('iso'),
        });
        toast.success('Cuenta creada');
      }
      cerrarModalCuenta();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la cuenta');
    }
  }

  // ── Transferencia form ─────────────────────────────────────────────────────

  const {
    register: regTrans,
    handleSubmit: handleTrans,
    control: controlTrans,
    reset: resetTrans,
    watch: watchTrans,
    setValue: setValueTrans,
    formState: { errors: errTrans, isSubmitting: submitingTrans },
  } = useForm<FormTransferencia>({
    resolver: zodResolver(schemaTransferencia),
    defaultValues: { cuentaOrigenId: '', cuentaDestinoId: '', monto: 0, descripcion: '' },
  });

  const montoTrans = watchTrans('monto') ?? 0;
  const origenId = watchTrans('cuentaOrigenId');
  const destinoId = watchTrans('cuentaDestinoId');
  const origenCuenta = finanzas.cuentas.find((c) => c.id === origenId);
  const destinoCuenta = finanzas.cuentas.find((c) => c.id === destinoId);

  async function onSubmitTransferencia(data: FormTransferencia) {
    try {
      const ok = await finanzas.transferirDinero({
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: data.monto,
        descripcion: data.descripcion || 'Transferencia entre cuentas',
        fecha: new Date().toISOString().split('T')[0],
      });
      if (!ok) {
        toast.error('No se pudo completar la transferencia');
        return;
      }
      toast.success('Transferencia realizada');
      resetTrans();
      setModalTransferencia(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error en la transferencia');
    }
  }

  async function handleVoiceTransfer(data: {
    cuentaOrigenId: string;
    cuentaDestinoId: string;
    monto: number;
    descripcion?: string;
  }) {
    const origen = finanzas.cuentas.find((c) => c.id === data.cuentaOrigenId);
    const destino = finanzas.cuentas.find((c) => c.id === data.cuentaDestinoId);
    if (!origen || !destino) {
      toast.error('No se encontraron las cuentas');
      return;
    }

    const ok = await finanzas.transferirDinero({
      cuentaOrigenId: data.cuentaOrigenId,
      cuentaDestinoId: data.cuentaDestinoId,
      monto: data.monto,
      descripcion: data.descripcion ?? `Transferencia ${origen.nombre} → ${destino.nombre}`,
      fecha: new Date().toISOString().split('T')[0],
    });

    if (!ok) {
      toast.error('No se pudo completar la transferencia');
      return;
    }

    toast.success(
      `Transferencia: ${formatearMoneda(data.monto, origen.moneda)} de ${origen.nombre} a ${destino.nombre}`,
    );
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  async function handleEliminar() {
    if (!cuentaAEliminar) return;
    setEliminando(true);
    try {
      await finanzas.eliminarCuenta(cuentaAEliminar.id);
      toast.success('Cuenta eliminada');
    } catch {
      toast.error('Error al eliminar la cuenta');
    } finally {
      setEliminando(false);
      setCuentaAEliminar(null);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const totales = useMemo(() => {
    const result: Record<Moneda, number> = { ARS: 0, USD: 0 };
    finanzas.cuentas.filter((c) => c.activa).forEach((c) => {
      result[c.moneda] = (result[c.moneda] ?? 0) + c.saldoActual;
    });
    return result;
  }, [finanzas.cuentas]);

  const totalGeneral = totales.ARS + (dolar.cotizacion ? dolar.convertirUSDaARS(totales.USD) : 0);

  const cuentasOrdenadas = useMemo(
    () => [...finanzas.cuentas].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [finanzas.cuentas]
  );

  const cuentasActivas = finanzas.cuentas.filter((c) => c.activa);

  if (finanzas.loading && finanzas.cuentas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <PiggyBank className="h-7 w-7 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Saldos</h1>
            <p className="text-sm text-slate2">Administrá tus cuentas y saldos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VoiceTransferButton
            cuentas={finanzas.cuentas}
            onTransferExtracted={handleVoiceTransfer}
          />
          <Button variant="outline" onClick={() => setModalTransferencia(true)} className="shrink-0 whitespace-nowrap">
            <ArrowLeftRight className="h-4 w-4" />
            Transferir
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">Total ARS</p>
          <p className="text-2xl font-black text-emerald-900">{formatearMoneda(totales.ARS)}</p>
        </Card>

        <Card className="bg-brand/5 border-brand/20">
          <p className="text-xs font-bold uppercase tracking-wider text-brand mb-1">Total USD</p>
          <p className="text-2xl font-black text-brand">
            {new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0 }).format(totales.USD)} USD
          </p>
          {dolar.cotizacion && totales.USD > 0 && (
            <p className="text-xs text-slate2 mt-0.5">≈ {formatearMoneda(dolar.convertirUSDaARS(totales.USD))}</p>
          )}
        </Card>

        <Card className="bg-violet-50 border-violet-200">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700 mb-1">Total General (ARS)</p>
          <p className="text-2xl font-black text-violet-900">{formatearMoneda(totalGeneral)}</p>
          <p className="text-xs text-slate2 mt-0.5">{cuentasActivas.length} cuentas activas</p>
        </Card>
      </div>

      {/* Accounts table */}
      <Card title="Cuentas Registradas">
        {cuentasOrdenadas.length === 0 ? (
          <div className="text-center py-12">
            <PiggyBank className="h-10 w-10 mx-auto opacity-20 mb-3" />
            <p className="font-semibold text-ink">Sin cuentas registradas</p>
            <Button variant="outline" className="mt-4" onClick={() => abrirModalCuenta()}>
              <Plus className="h-4 w-4" />
              Agregar primera cuenta
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-mist/60">
              {cuentasOrdenadas.map((cuenta) => (
                <div
                  key={cuenta.id}
                  className={`py-3 ${!cuenta.activa ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink text-sm leading-snug">{cuenta.nombre}</p>
                      <p className="text-[11px] text-slate2 mt-0.5">
                        Actualizado: {formatearFecha(cuenta.fechaActualizacion)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setCuentaMovimientos(cuenta)}
                        className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                        title="Ver movimientos"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => abrirModalCuenta(cuenta)}
                        className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setCuentaAEliminar(cuenta)}
                        className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${cuentaPillClass(cuenta.nombre)}`}>
                      {tipoLabel(cuenta.tipo)}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                      cuenta.moneda === 'USD' ? 'bg-brand/10 text-brand' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {cuenta.moneda}
                    </span>
                    <button
                      onClick={() => finanzas.actualizarCuenta(cuenta.id, { activa: !cuenta.activa })}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors ${
                        cuenta.activa
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-mist text-slate2 hover:bg-mist'
                      }`}
                    >
                      {cuenta.activa ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {cuenta.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </div>

                  <p className={`text-base font-bold leading-tight ${cuenta.saldoActual < 0 ? 'text-red-600' : 'text-ink'}`}>
                    {formatearMoneda(cuenta.saldoActual, cuenta.moneda)}
                  </p>
                  {cuenta.moneda === 'USD' && dolar.cotizacion && (
                    <p className="text-xs text-slate2 mt-0.5">
                      ≈ {formatearMoneda(dolar.convertirUSDaARS(cuenta.saldoActual))}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist">
                  <th className="text-left py-3 px-2 font-medium text-slate2">Nombre</th>
                  <th className="text-left py-3 px-2 font-medium text-slate2">Tipo</th>
                  <th className="text-right py-3 px-2 font-medium text-slate2">Saldo</th>
                  <th className="hidden sm:table-cell text-center py-3 px-2 font-medium text-slate2">Moneda</th>
                  <th className="text-center py-3 px-2 font-medium text-slate2">Estado</th>
                  <th className="text-right py-3 px-2 font-medium text-slate2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {cuentasOrdenadas.map((cuenta) => (
                  <tr key={cuenta.id} className={`hover:bg-paper/60 transition-colors ${!cuenta.activa ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-2">
                      <p className="font-semibold text-ink">{cuenta.nombre}</p>
                      <p className="text-xs text-slate2">Actualizado: {formatearFecha(cuenta.fechaActualizacion)}</p>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${cuentaPillClass(cuenta.nombre)}`}>
                        {tipoLabel(cuenta.tipo)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <p className={`font-bold ${cuenta.saldoActual < 0 ? 'text-red-600' : 'text-ink'}`}>
                        {formatearMoneda(cuenta.saldoActual, cuenta.moneda)}
                      </p>
                      {cuenta.moneda === 'USD' && dolar.cotizacion && (
                        <p className="text-xs text-slate2">≈ {formatearMoneda(dolar.convertirUSDaARS(cuenta.saldoActual))}</p>
                      )}
                    </td>
                    <td className="hidden sm:table-cell py-3 px-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                        cuenta.moneda === 'USD' ? 'bg-brand/10 text-brand' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {cuenta.moneda}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => finanzas.actualizarCuenta(cuenta.id, { activa: !cuenta.activa })}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                          cuenta.activa
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-mist text-slate2 hover:bg-mist'
                        }`}
                      >
                        {cuenta.activa ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {cuenta.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setCuentaMovimientos(cuenta)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Ver movimientos"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => abrirModalCuenta(cuenta)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setCuentaAEliminar(cuenta)}
                          className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>

      {/* ── Modal: Nueva / Editar Cuenta ──────────────────────────────────── */}
      {modalCuenta && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-ink">
                {cuentaEditando ? 'Editar Cuenta' : 'Nueva Cuenta'}
              </h3>
              <button onClick={cerrarModalCuenta} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCuenta(onSubmitCuenta)} className="space-y-4">
              <Input
                label="Nombre de la cuenta"
                {...regCuenta('nombre')}
                error={errCuenta.nombre?.message}
                placeholder="Ej: Caja de Ahorro Santander"
              />

              <Select
                label="Tipo de cuenta"
                {...regCuenta('tipo')}
                options={TIPOS_CUENTA}
                error={errCuenta.tipo?.message}
              />

              <Select
                label="Moneda"
                {...regCuenta('moneda')}
                options={MONEDAS}
                error={errCuenta.moneda?.message}
              />

              <Controller
                name="saldoActual"
                control={controlCuenta}
                render={({ field }) => (
                  <MoneyInput
                    label="Saldo actual"
                    value={field.value}
                    onChange={field.onChange}
                    moneda={monedaCuenta}
                    error={errCuenta.saldoActual?.message}
                  />
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={cerrarModalCuenta} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={submitingCuenta} className="flex-1">
                  {cuentaEditando ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Transferencia ──────────────────────────────────────────── */}
      {modalTransferencia && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-mist">
              <h3 className="text-lg font-bold text-ink">Mover dinero</h3>
              <div className="flex items-center gap-2">
                <VoiceTransferButton
                  compact
                  cuentas={finanzas.cuentas}
                  onTransferExtracted={async (data) => {
                    await handleVoiceTransfer(data);
                    setModalTransferencia(false);
                    resetTrans();
                  }}
                />
                <button onClick={() => { setModalTransferencia(false); resetTrans(); }} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleTrans(onSubmitTransferencia)} className="p-6 space-y-5">
              {/* Visual account selector */}
              <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-start">
                {/* Origen */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate2 mb-2">Desde</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {cuentasActivas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setValueTrans('cuentaOrigenId', c.id);
                          if (destinoId === c.id) setValueTrans('cuentaDestinoId', '');
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                          origenId === c.id
                            ? 'border-brand bg-brand/5 shadow-sm'
                            : 'border-mist hover:border-brand/40 hover:bg-paper'
                        }`}
                      >
                        <p className="text-xs font-semibold text-ink leading-snug">{c.nombre}</p>
                        <p className={`text-xs mt-0.5 font-medium ${c.saldoActual < 0 ? 'text-red-500' : 'text-slate2'}`}>
                          {formatearMoneda(c.saldoActual, c.moneda)}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errTrans.cuentaOrigenId && (
                    <p className="text-xs text-red-500 mt-1">{errTrans.cuentaOrigenId.message}</p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center mt-8">
                  <div className={`p-1.5 rounded-full transition-colors ${origenId && destinoId ? 'bg-brand text-white' : 'bg-mist text-slate2'}`}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Destino */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate2 mb-2">Hacia</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {cuentasActivas.map((c) => {
                      const esMismaOrigen = c.id === origenId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={esMismaOrigen}
                          onClick={() => setValueTrans('cuentaDestinoId', c.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                            esMismaOrigen
                              ? 'border-mist opacity-30 cursor-not-allowed'
                              : destinoId === c.id
                                ? 'border-brand bg-brand/5 shadow-sm'
                                : 'border-mist hover:border-brand/40 hover:bg-paper'
                          }`}
                        >
                          <p className="text-xs font-semibold text-ink leading-snug">{c.nombre}</p>
                          <p className={`text-xs mt-0.5 font-medium ${c.saldoActual < 0 ? 'text-red-500' : 'text-slate2'}`}>
                            {formatearMoneda(c.saldoActual, c.moneda)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {errTrans.cuentaDestinoId && (
                    <p className="text-xs text-red-500 mt-1">{errTrans.cuentaDestinoId.message}</p>
                  )}
                </div>
              </div>

              {/* Monto + descripción */}
              <div className="space-y-3">
                <Controller
                  name="monto"
                  control={controlTrans}
                  render={({ field }) => (
                    <MoneyInput
                      label="Monto"
                      value={field.value}
                      onChange={field.onChange}
                      error={errTrans.monto?.message}
                    />
                  )}
                />
                <Input
                  label="Descripción (opcional)"
                  {...regTrans('descripcion')}
                  placeholder="Ej: Ahorro mensual"
                />
              </div>

              {/* Preview */}
              {origenCuenta && destinoCuenta && montoTrans > 0 && (
                <div className="flex items-center gap-2 bg-brand/5 border border-brand/20 rounded-xl px-4 py-3 text-sm">
                  <span className="font-semibold text-ink truncate">{origenCuenta.nombre}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                  <span className="font-semibold text-ink truncate">{destinoCuenta.nombre}</span>
                  <span className="ml-auto font-bold text-brand whitespace-nowrap">
                    {formatearMoneda(montoTrans, origenCuenta.moneda)}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => { setModalTransferencia(false); resetTrans(); }} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={submitingTrans} className="flex-1">
                  <ArrowRight className="h-4 w-4" />
                  Transferir
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Movimientos ────────────────────────────────────────────── */}
      {cuentaMovimientos && (
        <MovimientosModal
          cuenta={cuentaMovimientos}
          onClose={() => setCuentaMovimientos(null)}
          finanzas={finanzas}
        />
      )}

      {/* ── Confirm: Eliminar ─────────────────────────────────────────────── */}
      <ModalConfirmacion
        open={!!cuentaAEliminar}
        title="Eliminar Cuenta"
        message={`¿Eliminás la cuenta "${cuentaAEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleEliminar}
        onCancel={() => setCuentaAEliminar(null)}
        onClose={() => setCuentaAEliminar(null)}
      />

      {eliminando && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
          <Spinner className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}
