import { useState, useMemo, useCallback } from 'react';
import { Plus, Calculator, Search, X, Edit, Trash2, Mic, MicOff, Loader2 } from 'lucide-react';
import { useOpenSettings } from '@/shared/hooks/use-open-settings';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSelect, SearchableSelect } from '@nodocore/shared-components';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { Spinner } from '@/components/ui/spinner';
import { ResumenCategorias } from './resumen-categorias';
import { RegistroGastoFijo } from './registro-gasto-fijo';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { useDolar } from '@/hooks/use-dolar';
import { useExtractGastoFijoFromVoice, type ExtractedGastoFijo } from './hooks/use-extract-gasto-fijo-from-voice';
import { formatearMoneda, esFechaDelMesActual } from '@/utils/formatters';
import { cuentaPillClass } from '@/utils/cuenta-colors';
import { normalizarCodigoRubro } from '@/utils/rubro-formatters';
import type { GastoFijo } from '@/types';

type VoiceState = 'idle' | 'listening' | 'extracting' | 'error';

export function GastosFijosPage() {
  const finanzas = useFinanzas();
  const dolar = useDolar();
  const { rubrosActivos } = useRubros();
  const { extract, hasApiKey } = useExtractGastoFijoFromVoice();
  const { openSettings } = useOpenSettings();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<GastoFijo | null>(null);
  const [esDuplicacion, setEsDuplicacion] = useState(false);
  const [datosIniciales, setDatosIniciales] = useState<ExtractedGastoFijo | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
    setDatosIniciales(null);
  }

  const handleVoiceClick = useCallback(() => {
    if (!hasApiKey) {
      setVoiceError('NO_API_KEY');
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('NO_BROWSER_SUPPORT');
      return;
    }
    setVoiceError(null);
    setVoiceState('listening');

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceState('extracting');
      try {
        const datos = await extract(transcript, rubrosActivos);
        setDatosIniciales(datos);
        abrirFormulario();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ERROR';
        if (msg === 'NO_MONTO') setVoiceError('NO_MONTO');
        else if (msg === 'NO_API_KEY') setVoiceError('NO_API_KEY');
        else setVoiceError('GENERIC');
      } finally {
        setVoiceState('idle');
      }
    };

    recognition.onerror = () => {
      setVoiceState('idle');
      setVoiceError('MIC_ERROR');
    };

    recognition.onend = () => {
      if (voiceState === 'listening') setVoiceState('idle');
    };

    recognition.start();
  }, [hasApiKey, extract, rubrosActivos, voiceState, abrirFormulario]);

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
        datosIniciales={datosIniciales}
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
          <p className="text-sm sm:text-lg lg:text-xl font-black text-ink mt-1 leading-tight">{formatearMoneda(totalARS)}</p>
        </Card>
        <Card className="border-brand/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total USD</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-ink mt-1 leading-tight">{formatearMoneda(totalUSD, 'USD')}</p>
          {dolar.cotizacion && totalUSD > 0 && (
            <p className="text-[10px] text-slate2">≈ {formatearMoneda(dolar.convertirUSDaARS(totalUSD))}</p>
          )}
        </Card>
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">Total General</p>
          <p className="text-sm sm:text-lg lg:text-xl font-black text-ink mt-1 leading-tight">{formatearMoneda(totalGeneral)}</p>
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
              className="bg-white pl-9 pr-9"
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
            <SearchableSelect
              value={rubroFiltro}
              onChange={setRubroFiltro}
              options={rubrosUnicos.map((rubro) => ({
                value: rubro.id,
                label: `${rubro.emoji} ${normalizarCodigoRubro(rubro.nombre)}`,
              }))}
              allowEmpty
              emptyLabel="Todos los rubros"
              searchPlaceholder="Buscar rubro..."
              className="flex-1 sm:w-48"
              triggerClassName="bg-white"
            />

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

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="success"
              onClick={handleVoiceClick}
              disabled={voiceState === 'extracting'}
              className={`shrink-0 whitespace-nowrap ${voiceState === 'listening' ? 'animate-pulse !bg-red-500 !border-red-500' : ''}`}
            >
              {voiceState === 'listening' ? (
                <MicOff className="h-4 w-4" />
              ) : voiceState === 'extracting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {voiceState === 'listening'
                ? 'Escuchando…'
                : voiceState === 'extracting'
                ? 'Procesando…'
                : 'Cargá tu gasto por voz'}
            </Button>
            {voiceState === 'listening' && (
              <span className="absolute -top-1 -right-1 h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            )}
            {voiceError && (
              <div className="absolute top-full mt-2 left-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-red-200 bg-white p-3 shadow-lg text-xs text-red-700">
                {voiceError === 'NO_API_KEY' ? (
                  <>
                    <p className="font-semibold mb-1">API Key no configurada</p>
                    <button
                      onClick={() => openSettings('ai')}
                      className="underline font-medium"
                    >
                      Ir a Configuración → IA
                    </button>
                  </>
                ) : voiceError === 'NO_BROWSER_SUPPORT' ? (
                  <p>Tu navegador no soporta grabación de voz. Usá Chrome o Edge.</p>
                ) : voiceError === 'NO_MONTO' ? (
                  <p>No se detectó el monto. Intentá de nuevo mencionando el importe.</p>
                ) : voiceError === 'MIC_ERROR' ? (
                  <p>No se pudo acceder al micrófono. Verificá los permisos.</p>
                ) : (
                  <p>No se pudo procesar el dictado. Intentá de nuevo.</p>
                )}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => abrirFormulario()}
            className="shrink-0 whitespace-nowrap mr-4 !bg-green-100 !text-green-800 hover:!bg-green-200 !border-transparent"
          >
            <Plus className="h-4 w-4" />
            Gasto Fijo
          </Button>
        </div>
      </div>

      {/* List */}
      <Card title="Gastos Fijos Registrados">
        {gastosOrdenados.length === 0 ? (
          <div className="py-16 text-center text-slate2">
            <div className="flex flex-col items-center gap-2">
              <Calculator className="h-10 w-10 opacity-20" />
              <p className="font-semibold text-ink">Sin gastos fijos</p>
              <p className="text-xs">Agregá tu primer gasto fijo mensual.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-mist/60">
              {gastosOrdenados.map((gasto) => {
                const isPagado = estaPagadoEsteMes(gasto.id);
                const rubro = rubrosMap.get(gasto.rubroId);
                return (
                  <div
                    key={gasto.id}
                    className={`py-3 ${!gasto.activo ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <RubroDisplay rubro={rubro} />
                      <button
                        onClick={() => finanzas.actualizarGastoFijo(gasto.id, { activo: !gasto.activo })}
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border tracking-wider transition-all shrink-0 ${
                          gasto.activo
                            ? 'bg-mist text-brand border-brand/30 hover:bg-brand/10'
                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {gasto.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>

                    <p className={`font-semibold text-sm leading-snug ${isPagado ? 'text-brand' : 'text-ink'}`}>
                      {gasto.descripcion}
                    </p>
                    {gasto.etiqueta && (
                      <p className="text-xs text-slate2 mt-0.5">{gasto.etiqueta}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
                      <p className={`text-base font-bold leading-tight ${isPagado ? 'text-brand' : 'text-ink'}`}>
                        {formatearMoneda(gasto.monto, gasto.moneda)}
                      </p>
                      {gasto.moneda === 'USD' && dolar.cotizacion && (
                        <p className="text-[11px] text-slate2">
                          ≈ {formatearMoneda(dolar.convertirUSDaARS(gasto.monto))}
                        </p>
                      )}
                      {(() => {
                        const cuenta = gasto.cuentaId ? finanzas.cuentas.find((c) => c.id === gasto.cuentaId) : null;
                        const pillClass = cuenta ? cuentaPillClass(cuenta.nombre) : 'bg-mist text-slate2';
                        const n = cuenta ? cuenta.nombre.toLowerCase().replace(/\s+/g, '') : '';
                        const banco = n.includes('santander') ? ' Santander' : n.includes('pampa') ? ' Pampa' : '';
                        const esMPReserva = n.includes('mercadopago') && n.includes('reserva');
                        const label =
                          gasto.formaDePago === 'MERCADO_PAGO' ? (esMPReserva ? 'MP Reservas' : 'Mercado Pago') :
                          gasto.formaDePago === 'DEBITO' ? `Débito${banco}` :
                          gasto.formaDePago === 'TRANSFERENCIA BANCO' ? `Transfer.${banco}` :
                          gasto.formaDePago === 'EFECTIVO' ? 'Efectivo' :
                          gasto.formaDePago;
                        return (
                          <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md ${pillClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>

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
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
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
                      {(() => {
                        const cuenta = gasto.cuentaId ? finanzas.cuentas.find((c) => c.id === gasto.cuentaId) : null;
                        const pillClass = cuenta ? cuentaPillClass(cuenta.nombre) : 'bg-mist text-slate2';
                        const n = cuenta ? cuenta.nombre.toLowerCase().replace(/\s+/g, '') : '';
                        const banco = n.includes('santander') ? ' Santander' : n.includes('pampa') ? ' Pampa' : '';
                        const esMPReserva = n.includes('mercadopago') && n.includes('reserva');
                        const label =
                          gasto.formaDePago === 'MERCADO_PAGO' ? (esMPReserva ? 'MP Reservas' : 'Mercado Pago') :
                          gasto.formaDePago === 'DEBITO' ? `Débito${banco}` :
                          gasto.formaDePago === 'TRANSFERENCIA BANCO' ? `Transfer.${banco}` :
                          gasto.formaDePago === 'EFECTIVO' ? 'Efectivo' :
                          gasto.formaDePago;
                        return (
                          <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md ${pillClass}`}>
                            {label}
                          </span>
                        );
                      })()}
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
            </tbody>
          </table>
            </div>
          </>
        )}
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
                    <FormSelect
                      value={formaPagoModal}
                      onChange={setFormaPagoModal}
                      options={[
                        { value: 'EFECTIVO', label: 'Efectivo' },
                        { value: 'DEBITO', label: 'Débito Automático' },
                        { value: 'TARJETA', label: 'Tarjeta de Crédito' },
                        { value: 'TRANSFERENCIA BANCO', label: 'Transferencia Bancaria' },
                        { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
                      ]}
                    />
                  </div>

                  {(formaPagoModal === 'DEBITO' ||
                    formaPagoModal === 'TRANSFERENCIA BANCO' ||
                    formaPagoModal === 'MERCADO_PAGO' ||
                    formaPagoModal === 'EFECTIVO') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-ink">Cuenta / Caja</label>
                      <FormSelect
                        value={cuentaSeleccionadaId}
                        onChange={setCuentaSeleccionadaId}
                        options={finanzas.cuentas
                          .filter((cuenta) => cuenta.activa)
                          .map((cuenta) => ({
                            value: cuenta.id,
                            label: `${cuenta.nombre} (${formatearMoneda(cuenta.saldoActual, cuenta.moneda)})`,
                          }))}
                        allowEmpty
                        emptyLabel="Seleccioná una cuenta..."
                      />
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
