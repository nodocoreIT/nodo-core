import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, PiggyBank, History, ArrowLeftRight, X } from 'lucide-react';
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
import { FinanzasService } from '@/services/finanzas-service';
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

interface MovimientosModalProps {
  cuenta: Cuenta;
  onClose: () => void;
}

function MovimientosModal({ cuenta, onClose }: MovimientosModalProps) {
  const [movimientos, setMovimientos] = useState<MovimientoCuenta[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    FinanzasService.obtenerMovimientosCuenta(cuenta.id)
      .then((data) => setMovimientos(data))
      .catch(() => toast.error('Error al cargar movimientos'))
      .finally(() => setLoading(false));
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-mist">
          <div>
            <h3 className="text-base font-bold text-ink">Movimientos</h3>
            <p className="text-xs text-slate2">{cuenta.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : movimientos.length === 0 ? (
            <p className="text-center text-slate2 py-8 text-sm">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-2">
              {movimientos.slice(0, 50).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-mist/60 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.descripcion}</p>
                    <p className="text-xs text-slate2">{formatearFecha(m.fecha)}</p>
                  </div>
                  <span className={`text-sm font-bold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{formatearMoneda(Math.abs(m.monto), cuenta.moneda)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
    setValue: setCuentaVal,
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
    formState: { errors: errTrans, isSubmitting: submitingTrans },
  } = useForm<FormTransferencia>({
    resolver: zodResolver(schemaTransferencia),
    defaultValues: { cuentaOrigenId: '', cuentaDestinoId: '', monto: 0, descripcion: '' },
  });

  const montoTrans = watchTrans('monto') ?? 0;

  async function onSubmitTransferencia(data: FormTransferencia) {
    try {
      await finanzas.transferirDinero({
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: data.monto,
        descripcion: data.descripcion || 'Transferencia entre cuentas',
      });
      toast.success('Transferencia realizada');
      resetTrans();
      setModalTransferencia(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error en la transferencia');
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PiggyBank className="h-7 w-7 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Saldos</h1>
            <p className="text-sm text-slate2">Administrá tus cuentas y saldos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalTransferencia(true)}>
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Transferir</span>
          </Button>
          <Button size="sm" onClick={() => abrirModalCuenta()}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva Cuenta</span>
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
          <div className="overflow-x-auto">
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
                      <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${tipoBadgeClass(cuenta.tipo)}`}>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-ink">Transferencia entre Cuentas</h3>
              <button onClick={() => { setModalTransferencia(false); resetTrans(); }} className="p-1.5 hover:bg-mist rounded-lg text-slate2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTrans(onSubmitTransferencia)} className="space-y-4">
              <Select
                label="Cuenta origen"
                {...regTrans('cuentaOrigenId')}
                options={[
                  { value: '', label: '— Seleccioná origen —' },
                  ...cuentasActivas.map((c) => ({
                    value: c.id,
                    label: `${c.nombre} (${formatearMoneda(c.saldoActual, c.moneda)})`,
                  })),
                ]}
                error={errTrans.cuentaOrigenId?.message}
              />

              <Select
                label="Cuenta destino"
                {...regTrans('cuentaDestinoId')}
                options={[
                  { value: '', label: '— Seleccioná destino —' },
                  ...cuentasActivas.map((c) => ({
                    value: c.id,
                    label: `${c.nombre} (${formatearMoneda(c.saldoActual, c.moneda)})`,
                  })),
                ]}
                error={errTrans.cuentaDestinoId?.message}
              />

              <Controller
                name="monto"
                control={controlTrans}
                render={({ field }) => (
                  <MoneyInput
                    label="Monto a transferir"
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

              {montoTrans > 0 && (
                <div className="bg-mist/40 rounded-xl p-3 text-sm text-slate2">
                  Se transferirán <strong className="text-ink">{formatearMoneda(montoTrans)}</strong> entre las cuentas seleccionadas.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setModalTransferencia(false); resetTrans(); }} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={submitingTrans} className="flex-1">
                  <ArrowLeftRight className="h-4 w-4" />
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
