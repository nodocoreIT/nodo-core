import { useState, useMemo } from 'react';
import { Plus, Calculator, Search, X, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { Spinner } from '@/components/ui/spinner';
import { ResumenCategorias } from './resumen-categorias';
import { RegistroGastoFijo } from './registro-gasto-fijo';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { useDolar } from '@/hooks/use-dolar';
import { formatearMoneda, esFechaDelMesActual } from '@/utils/formatters';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import type { GastoFijo } from '@/types';

export function GastosFijosPage() {
  const finanzas = useFinanzas();
  const dolar = useDolar();
  const { rubrosActivos } = useRubros();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<GastoFijo | null>(null);
  const [esDuplicacion, setEsDuplicacion] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState<GastoFijo | null>(null);

  // Payment modal state
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  const [gastoParaPagar, setGastoParaPagar] = useState<GastoFijo | null>(null);
  const [formaPagoModal, setFormaPagoModal] = useState('DEBITO');
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState('');
  const [esSilenciosoModal, setEsSilenciosoModal] = useState(false);
  const [cargandoPago, setCargandoPago] = useState(false);

  const rubrosMap = useMemo(() => {
    const m = new Map<string, typeof rubrosActivos[0]>();
    rubrosActivos.forEach((r) => m.set(r.id, r));
    return m;
  }, [rubrosActivos]);

  const gastosOrdenados = useMemo(() => {
    let list = finanzas.gastosFijos.filter((g) => (mostrarInactivos ? !g.activo : g.activo));

    if (busqueda.trim()) {
      const t = busqueda.toLowerCase();
      list = list.filter(
        (g) =>
          g.descripcion.toLowerCase().includes(t) ||
          g.formaDePago.toLowerCase().includes(t) ||
          (g.etiqueta && g.etiqueta.toLowerCase().includes(t))
      );
    }

    if (rubroFiltro) {
      list = list.filter((g) => g.rubroId === rubroFiltro);
    }

    return [...list].sort((a, b) => {
      const ra = rubrosMap.get(a.rubroId)?.nombre ?? '';
      const rb = rubrosMap.get(b.rubroId)?.nombre ?? '';
      return ra.localeCompare(rb);
    });
  }, [finanzas.gastosFijos, busqueda, rubroFiltro, mostrarInactivos, rubrosMap]);

  function estaPagadoEsteMes(gastoId: string): boolean {
    return finanzas.gastosDiarios.some(
      (gd) => gd.gastoFijoId === gastoId && esFechaDelMesActual(gd.fecha)
    );
  }

  function abrirFormulario(gasto?: GastoFijo, duplicar = false) {
    setGastoEditando(gasto ?? null);
    setEsDuplicacion(duplicar);
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setGastoEditando(null);
    setEsDuplicacion(false);
  }

  async function handleGastoRegistrado() {
    await finanzas.recargarGastosFijos();
  }

  async function handleEliminar() {
    if (!gastoAEliminar) return;
    try {
      await finanzas.eliminarGastoFijo(gastoAEliminar.id);
      toast.success('Gasto fijo eliminado');
    } catch {
      toast.error('Error al eliminar el gasto fijo');
    } finally {
      setGastoAEliminar(null);
    }
  }

  function abrirModalPago(gasto: GastoFijo) {
    const gastoVinculado = finanzas.gastosDiarios.find(
      (gd) => gd.gastoFijoId === gasto.id && esFechaDelMesActual(gd.fecha)
    );

    if (gastoVinculado) {
      // Already paid — untoggle
      finanzas.eliminarGastoDiario(gastoVinculado.id).then(() => {
        toast.success('Pago revertido');
      });
      return;
    }

    setGastoParaPagar(gasto);
    setFormaPagoModal(gasto.formaDePago || 'DEBITO');
    setCuentaSeleccionadaId('');
    setEsSilenciosoModal(false);
    setModalPagoAbierto(true);
  }

  async function confirmarPago() {
    if (!gastoParaPagar) return;
    setCargandoPago(true);
    setModalPagoAbierto(false);

    try {
      await finanzas.agregarGastoDiario({
        descripcion: gastoParaPagar.descripcion,
        detalle: `Pago Gasto Fijo: ${gastoParaPagar.descripcion}`,
        monto: gastoParaPagar.monto,
        fecha: new Date().toISOString().split('T')[0],
        rubroId: gastoParaPagar.rubroId,
        formaPago: formaPagoModal as GastoFijo['formaDePago'],
        tarjetaId: formaPagoModal === 'TARJETA' ? (gastoParaPagar.tarjetaId || undefined) : undefined,
        cuentaId:
          formaPagoModal !== 'TARJETA' && cuentaSeleccionadaId ? cuentaSeleccionadaId : undefined,
        gastoFijoId: gastoParaPagar.id,
        prestamoId: gastoParaPagar.prestamoId,
        planId: gastoParaPagar.planId,
        esSilencioso: esSilenciosoModal,
        codigoOperacion: crypto.randomUUID(),
      });
      toast.success('Pago registrado');
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setCargandoPago(false);
      setGastoParaPagar(null);
    }
  }

  const totalARS = finanzas.gastosFijos
    .filter((g) => g.activo && g.moneda === 'ARS')
    .reduce((s, g) => s + g.monto, 0);
  const totalUSD = finanzas.gastosFijos
    .filter((g) => g.activo && g.moneda === 'USD')
    .reduce((s, g) => s + g.monto, 0);
  const totalGeneral = totalARS + (dolar.cotizacion ? dolar.convertirUSDaARS(totalUSD) : 0);
  const activosCount = finanzas.gastosFijos.filter((g) => g.activo).length;
  const inactivosCount = finanzas.gastosFijos.filter((g) => !g.activo).length;

  const rubrosUnicos = useMemo(() => {
    const ids = new Set(finanzas.gastosFijos.map((g) => g.rubroId));
    return Array.from(ids)
      .map((id) => rubrosMap.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [finanzas.gastosFijos, rubrosMap]);

  if (finanzas.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (mostrarFormulario) {
    return (
      <RegistroGastoFijo
        onVolver={cerrarFormulario}
        onGastoRegistrado={handleGastoRegistrado}
        gastoEditando={gastoEditando}
        esDuplicacion={esDuplicacion}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="h-7 w-7 text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-ink">Gastos Fijos</h1>
          <p className="text-sm text-slate2">Administrá tus gastos mensuales recurrentes</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total ARS</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(totalARS)}</p>
        </Card>
        <Card className="border-brand/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total USD</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(totalUSD, 'USD')}</p>
          {dolar.cotizacion && totalUSD > 0 && (
            <p className="text-[10px] text-slate2">≈ {formatearMoneda(dolar.convertirUSDaARS(totalUSD))}</p>
          )}
        </Card>
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total General</p>
          <p className="text-xl font-black text-ink mt-1">{formatearMoneda(totalGeneral)}</p>
        </Card>
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Gastos</p>
          <p className="text-xl font-black text-ink mt-1">{activosCount} activos</p>
          <p className="text-[10px] text-slate2">{inactivosCount} inactivos</p>
        </Card>
      </div>

      {/* Category summary */}
      <ResumenCategorias />

      {/* Filters + Add */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
            <Input
              placeholder="Buscar gastos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-9"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={rubroFiltro}
              onChange={(e) => setRubroFiltro(e.target.value)}
              className="flex-1 sm:w-48 border border-mist rounded-lg px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-brand focus:border-brand outline-none"
            >
              <option value="">Todos los rubros</option>
              {rubrosUnicos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {normalizarCodigoRubro(r.nombre)}
                </option>
              ))}
            </select>

            <button
              className={`px-3 py-2 border rounded-lg text-xs font-bold transition-all ${
                mostrarInactivos
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white border-mist text-slate2 hover:bg-mist'
              }`}
              onClick={() => setMostrarInactivos(!mostrarInactivos)}
            >
              Inactivos
            </button>
          </div>
        </div>

        <Button onClick={() => abrirFormulario()} className="w-full">
          <Plus className="h-4 w-4" />
          Nuevo Gasto Fijo
        </Button>
      </div>

      {/* List */}
      <Card title="Gastos Fijos Registrados">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist">
                <th className="text-left py-3 px-2 font-medium text-slate2">Rubro</th>
                <th className="text-left py-3 px-2 font-medium text-slate2">Descripción</th>
                <th className="text-right py-3 px-2 font-medium text-slate2">Monto</th>
                <th className="hidden lg:table-cell text-center py-3 px-2 font-medium text-slate2">Pago</th>
                <th className="hidden sm:table-cell text-center py-3 px-2 font-medium text-slate2">Estado</th>
                <th className="text-right py-3 px-2 font-medium text-slate2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {gastosOrdenados.map((gasto) => {
                const isPagado = estaPagadoEsteMes(gasto.id);
                const rubro = rubrosMap.get(gasto.rubroId);
                return (
                  <tr
                    key={gasto.id}
                    className={`hover:bg-paper/50 transition-colors ${!gasto.activo ? 'opacity-50' : ''}`}
                  >
                    <td className="py-3 px-2">
                      <RubroDisplay rubro={rubro} />
                    </td>
                    <td className="py-3 px-2">
                      <p className={`font-semibold ${isPagado ? 'text-brand' : 'text-ink'}`}>
                        {gasto.descripcion}
                      </p>
                      {gasto.etiqueta && (
                        <p className="text-xs text-slate2">{gasto.etiqueta}</p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <p className={`font-bold ${isPagado ? 'text-brand' : 'text-ink'}`}>
                        {formatearMoneda(gasto.monto, gasto.moneda)}
                      </p>
                      {gasto.moneda === 'USD' && dolar.cotizacion && (
                        <p className="text-[10px] text-slate2">
                          ≈ {formatearMoneda(dolar.convertirUSDaARS(gasto.monto))}
                        </p>
                      )}
                    </td>
                    <td className="hidden lg:table-cell py-3 px-2 text-center">
                      <span className="text-[9px] font-bold uppercase bg-mist text-slate2 px-2 py-1 rounded-md">
                        {gasto.formaDePago}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell py-3 px-2 text-center">
                      <button
                        onClick={() => finanzas.actualizarGastoFijo(gasto.id, { activo: !gasto.activo })}
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border tracking-wider transition-all ${
                          gasto.activo
                            ? 'bg-mist text-brand border-brand/30 hover:bg-brand/10'
                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {gasto.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant={isPagado ? 'primary' : 'danger'}
                          onClick={() => abrirModalPago(gasto)}
                          disabled={!gasto.activo || cargandoPago}
                          className="text-[10px] px-2 h-7"
                        >
                          {isPagado ? 'Pagado' : 'Pagar'}
                        </Button>
                        <button
                          onClick={() => abrirFormulario(gasto)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Editar"
                          disabled={!gasto.activo}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setGastoAEliminar(gasto)}
                          className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {gastosOrdenados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate2">
                    <div className="flex flex-col items-center gap-2">
                      <Calculator className="h-10 w-10 opacity-20" />
                      <p className="font-semibold text-ink">Sin gastos fijos</p>
                      <p className="text-xs">Agregá tu primer gasto fijo mensual.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete modal */}
      <ModalConfirmacion
        open={!!gastoAEliminar}
        title="Eliminar Gasto Fijo"
        message={`¿Eliminás "${gastoAEliminar?.descripcion}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleEliminar}
        onCancel={() => setGastoAEliminar(null)}
        onClose={() => setGastoAEliminar(null)}
      />

      {/* Payment modal */}
      {modalPagoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <h3 className="text-lg font-bold text-ink mb-1">Confirmar Pago</h3>
            <p className="text-sm text-slate2 mb-5">
              Marcás como pagado: <strong className="text-ink">{gastoParaPagar?.descripcion}</strong>
            </p>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esSilenciosoModal}
                  onChange={(e) => setEsSilenciosoModal(e.target.checked)}
                  className="w-4 h-4 accent-brand"
                />
                <span className="text-sm text-ink">No generar movimiento en gastos diarios</span>
              </label>

              {!esSilenciosoModal && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-ink">Medio de Pago</label>
                    <select
                      value={formaPagoModal}
                      onChange={(e) => setFormaPagoModal(e.target.value)}
                      className="w-full px-3 py-2 border border-mist rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand outline-none"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="DEBITO">Débito Automático</option>
                      <option value="TARJETA">Tarjeta de Crédito</option>
                      <option value="TRANSFERENCIA BANCO">Transferencia Bancaria</option>
                      <option value="MERCADO_PAGO">Mercado Pago</option>
                    </select>
                  </div>

                  {(formaPagoModal === 'DEBITO' ||
                    formaPagoModal === 'TRANSFERENCIA BANCO' ||
                    formaPagoModal === 'MERCADO_PAGO' ||
                    formaPagoModal === 'EFECTIVO') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Cuenta / Caja</label>
                      <select
                        value={cuentaSeleccionadaId}
                        onChange={(e) => setCuentaSeleccionadaId(e.target.value)}
                        className="w-full px-3 py-2 border border-mist rounded-lg text-sm bg-white focus:ring-1 focus:ring-brand outline-none"
                      >
                        <option value="">Seleccioná una cuenta...</option>
                        {finanzas.cuentas.filter((c) => c.activa).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({formatearMoneda(c.saldoActual, c.moneda)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={confirmarPago}
                disabled={
                  !esSilenciosoModal &&
                  (formaPagoModal === 'DEBITO' ||
                    formaPagoModal === 'TRANSFERENCIA BANCO' ||
                    formaPagoModal === 'MERCADO_PAGO' ||
                    formaPagoModal === 'EFECTIVO') &&
                  !cuentaSeleccionadaId
                }
                className="flex-1"
              >
                Confirmar Pago
              </Button>
              <Button variant="outline" onClick={() => setModalPagoAbierto(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
