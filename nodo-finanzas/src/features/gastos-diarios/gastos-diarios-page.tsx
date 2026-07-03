import { useState, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Receipt, X, Mic, MicOff, Loader2, Copy, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOpenSettings } from '@/shared/hooks/use-open-settings';
import { foldForSearch } from '@nodocore/shared-components';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonthPicker } from '@/components/ui/month-picker';
import { ModalConfirmacion } from '@/components/ui/modal-confirmacion';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { Spinner } from '@/components/ui/spinner';
import { RegistroGastoDiario } from './registro-gasto-diario';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useAiSettings, getActiveApiKey } from '@/hooks/use-ai-settings';
import { useExtractGastoFromVoice } from './hooks/use-extract-gasto-from-voice';
import { useRubros } from '@/hooks/use-rubros';
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import { cuentaPillClass } from '@/utils/cuenta-colors';
import type { GastoDiario } from '@/types';

type VoiceState = 'idle' | 'listening' | 'extracting' | 'error';
type SortField = 'fecha' | 'descripcion' | 'rubro' | 'monto' | 'formaPago';
type SortDir = 'asc' | 'desc';

export function GastosDiariosPage() {
  const finanzas = useFinanzas();
  const { rubrosActivos } = useRubros();
  const { aiSettings } = useAiSettings();
  const { extract } = useExtractGastoFromVoice();
  const { openSettings } = useOpenSettings();
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<GastoDiario | null>(null);
  const [datosIniciales, setDatosIniciales] = useState<Partial<GastoDiario> | undefined>();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const hasApiKey = !!getActiveApiKey(aiSettings);
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const handleVoiceClick = useCallback(async () => {
    if (voiceState === 'listening') {
      recognitionRef.current?.stop();
      return;
    }

    if (!hasApiKey) {
      setVoiceError('Configurá tu API key en Configuración → Integraciones IA');
      setVoiceState('error');
      setTimeout(() => setVoiceState('idle'), 4000);
      return;
    }

    if (!isSupported) {
      setVoiceError('Tu navegador no soporta dictado por voz. Probá en Chrome o Edge.');
      setVoiceState('error');
      setTimeout(() => setVoiceState('idle'), 4000);
      return;
    }

    setVoiceError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SpeechRecognitionAPI() as any;
    recognitionRef.current = recognition;

    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setVoiceState('listening');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript.trim()) { setVoiceState('idle'); return; }

      setVoiceState('extracting');
      try {
        const parsed = await extract({
          texto: transcript,
          rubros: rubrosActivos,
          cuentas: finanzas.cuentas,
          tarjetas: finanzas.tarjetas,
          fechaReferencia: new Date().toISOString().slice(0, 10),
        });
        setDatosIniciales({
          descripcion: parsed.descripcion,
          monto: parsed.monto,
          fecha: parsed.fecha,
          formaPago: parsed.formaPago,
          rubroId: parsed.rubroId,
          rubro: parsed.rubroCodigo,
          cuotas: parsed.cuotas,
        });
        setGastoEditando(null);
        setMostrarFormulario(true);
        setVoiceState('idle');
      } catch {
        setVoiceError('No se pudo interpretar el dictado. Intentá de nuevo.');
        setVoiceState('error');
        setTimeout(() => setVoiceState('idle'), 4000);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') { setVoiceState('idle'); return; }
      setVoiceError('Error al escuchar. Verificá que el micrófono esté habilitado.');
      setVoiceState('error');
      setTimeout(() => setVoiceState('idle'), 4000);
    };

    recognition.onend = () => {
      setVoiceState((curr) => curr === 'listening' ? 'idle' : curr);
    };

    recognition.start();
  }, [voiceState, hasApiKey, isSupported, extract, rubrosActivos, finanzas]);
  const [filtroMes, setFiltroMes] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState<string | null>(null);
  const [gastoAEliminar, setGastoAEliminar] = useState<GastoDiario | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const gastosFiltrados = useMemo(() => {
    let list = finanzas.gastosDiarios.filter(
      (g) => !g.esSilencioso && g.fecha.startsWith(filtroMes)
    );

    if (busqueda.trim()) {
      const t = foldForSearch(busqueda);
      list = list.filter(
        (g) =>
          foldForSearch(g.descripcion).includes(t) ||
          (g.detalle && foldForSearch(g.detalle).includes(t))
      );
    }

    if (rubroFiltro) {
      list = list.filter((g) => g.rubroId === rubroFiltro);
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'fecha':       cmp = a.fecha.localeCompare(b.fecha); break;
        case 'descripcion': cmp = a.descripcion.localeCompare(b.descripcion, 'es'); break;
        case 'rubro': {
          const textOnly = (s: string) => s.replace(/^[^\p{L}]+/u, '');
          cmp = textOnly(a.rubro ?? '').localeCompare(textOnly(b.rubro ?? ''), 'es');
          break;
        }
        case 'monto':       cmp = a.monto - b.monto; break;
        case 'formaPago':   cmp = a.formaPago.localeCompare(b.formaPago, 'es'); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [finanzas.gastosDiarios, filtroMes, busqueda, rubroFiltro, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="inline h-3 w-3 ml-1 text-brand" />
      : <ChevronDown className="inline h-3 w-3 ml-1 text-brand" />;
  };

  const totalMes = gastosFiltrados.reduce((s, g) => s + g.monto, 0);
  const totalUSD = gastosFiltrados.filter((g) => g.montoUSD && g.montoUSD > 0)
    .reduce((s, g) => s + (g.montoUSD ?? 0), 0);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const esMesActual = filtroMes === hoyISO.slice(0, 7);

  const totalHastaHoy = useMemo(() => {
    if (!esMesActual) return totalMes;
    return gastosFiltrados
      .filter((g) => g.fecha <= hoyISO)
      .reduce((s, g) => s + g.monto, 0);
  }, [gastosFiltrados, esMesActual, hoyISO, totalMes]);

  const resumenPorCuenta = useMemo(() => {
    const map = new Map<string, { label: string; total: number; pillClass: string }>();
    for (const g of gastosFiltrados) {
      const label = obtenerEtiquetaFormaPago(g);
      const pill = obtenerPillClass(g);
      const existing = map.get(label);
      if (existing) {
        existing.total += g.monto;
      } else {
        map.set(label, { label, total: g.monto, pillClass: pill });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastosFiltrados, finanzas.cuentas, finanzas.tarjetas]);

  function abrirFormulario(gasto?: GastoDiario) {
    setGastoEditando(gasto ?? null);
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setGastoEditando(null);
    setDatosIniciales(undefined);
  }

  async function handleGastoRegistrado() {
    await finanzas.recargarDatos(true);
  }

  async function handleEliminar() {
    if (!gastoAEliminar) return;
    setEliminando(true);
    try {
      await finanzas.eliminarGastoDiario(gastoAEliminar.id);
      toast.success('Gasto eliminado');
    } catch {
      toast.error('Error al eliminar el gasto');
    } finally {
      setEliminando(false);
      setGastoAEliminar(null);
    }
  }

  // g.cuentaId is a saldo ID (FK to cuentas table). Look up the Cuenta by that ID.
  function resolverCuenta(g: GastoDiario) {
    if (!g.cuentaId) return null;
    return finanzas.cuentas.find((c) => c.id === g.cuentaId) ?? null;
  }

  function obtenerEtiquetaFormaPago(g: GastoDiario): string {
    if (g.formaPago === 'TARJETA' && g.tarjetaId) {
      const t = finanzas.tarjetas.find((t) => t.id === g.tarjetaId);
      return t ? `T. ${t.nombre}` : 'Tarjeta';
    }
    const cuenta = resolverCuenta(g);
    const n = cuenta ? cuenta.nombre.toLowerCase().replace(/\s+/g, '') : '';
    const banco = n.includes('santander') ? ' Santander' : n.includes('pampa') ? ' Pampa' : '';
    const esMPReserva = n.includes('mercadopago') && n.includes('reserva');
    if (g.formaPago === 'MERCADO_PAGO') return esMPReserva ? 'MP Reservas' : 'Mercado Pago';
    if (g.formaPago === 'DEBITO') return `Débito${banco}`;
    if (g.formaPago === 'TRANSFERENCIA BANCO') return `Transfer.${banco}`;
    if (g.formaPago === 'EFECTIVO') return 'Efectivo';
    return g.formaPago;
  }

  function obtenerPillClass(g: GastoDiario): string {
    if (g.formaPago === 'TARJETA' && g.tarjetaId) {
      const t = finanzas.tarjetas.find((t) => t.id === g.tarjetaId);
      return t ? cuentaPillClass(t.banco || t.nombre) : 'bg-mist text-slate2';
    }
    const cuenta = resolverCuenta(g);
    if (cuenta) return cuentaPillClass(cuenta.nombre);
    if (g.formaPago === 'EFECTIVO') return 'bg-emerald-100 text-emerald-800';
    if (g.formaPago === 'MERCADO_PAGO') return 'bg-[#009ee3] text-white';
    return 'bg-mist text-slate2';
  }

  if (finanzas.loading && finanzas.gastosDiarios.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (mostrarFormulario) {
    return (
      <RegistroGastoDiario
        onVolver={cerrarFormulario}
        onGastoRegistrado={handleGastoRegistrado}
        gastoEditando={gastoEditando}
        datosIniciales={datosIniciales}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Receipt className="h-7 w-7 text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-ink">Gastos Diarios</h1>
          <p className="text-sm text-slate2">Gestioná tus gastos del día a día</p>
        </div>
      </div>

      {/* Summary cards */}
      {gastosFiltrados.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {/* Total principal */}
          <Card className="border-red-100 min-w-[160px] flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate2">
              {esMesActual ? 'Total hasta hoy' : 'Total del mes'}
            </p>
            <p className="text-lg font-black text-ink mt-1 leading-tight">
              {formatearMoneda(totalHastaHoy)}
            </p>
            {esMesActual && totalMes !== totalHastaHoy && (
              <p className="text-[10px] text-slate2 mt-0.5">
                Mes completo: {formatearMoneda(totalMes)}
              </p>
            )}
            {totalUSD > 0 && (
              <p className="text-[10px] text-slate2 mt-0.5">{formatearMoneda(totalUSD, 'USD')}</p>
            )}
          </Card>

          {/* Breakdown por cuenta / forma de pago */}
          {resumenPorCuenta.map(({ label, total, pillClass }) => (
            <Card key={label} className="min-w-[140px] flex-shrink-0">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${pillClass}`}>
                {label}
              </span>
              <p className="text-base font-black text-ink leading-tight">
                {formatearMoneda(total)}
              </p>
              <p className="text-[10px] text-slate2 mt-0.5">
                {((total / totalMes) * 100).toFixed(0)}% del mes
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <MonthPicker value={filtroMes} onChange={setFiltroMes} className="self-start" />

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
          <input
            type="text"
            placeholder="Buscar por descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-mist bg-white focus:border-brand focus:ring-1 focus:ring-brand text-sm outline-none h-10"
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

        <div className="w-full sm:w-64">
          <RubroSelector
            rubroId={rubroFiltro}
            onChange={(r) => setRubroFiltro(r?.id ?? null)}
            placeholder="Todos los rubros"
            hideLabel
            triggerClassName="bg-white"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            type="button"
            variant="primary"
            onClick={handleVoiceClick}
            disabled={voiceState === 'extracting'}
            title={
              voiceState === 'listening' ? 'Escuchando… hacé clic para detener' :
              voiceState === 'extracting' ? 'Procesando con IA…' :
              !hasApiKey ? 'Configurá tu API key en Configuración → Integraciones IA' :
              'Cargá tu gasto por voz'
            }
            className={`shrink-0 whitespace-nowrap ${voiceState === 'listening' ? 'animate-pulse !bg-red-500 !border-red-500 hover:!bg-red-600' : ''}`}
          >
            {voiceState === 'extracting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : voiceState === 'listening' ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {voiceState === 'listening' ? 'Escuchando…' :
             voiceState === 'extracting' ? 'Procesando…' :
             'Cargá tu gasto por voz'}
          </Button>

          {voiceState === 'listening' && (
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500 ring-2 ring-white" />
          )}

          {voiceState === 'error' && voiceError && (
            <button
              type="button"
              role="alert"
              onClick={() => openSettings('ai')}
              className="absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] cursor-pointer rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700 shadow-md transition-colors hover:bg-red-100"
            >
              {voiceError}
              {!hasApiKey && (
                <span className="mt-0.5 block font-semibold underline">
                  Ir a Configuración → IA
                </span>
              )}
            </button>
          )}
        </div>

        <Button variant="secondary" onClick={() => abrirFormulario()} className="shrink-0 whitespace-nowrap mr-4">
          <Plus className="h-4 w-4" />
          Gasto Diario
        </Button>
      </div>

      {/* List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-ink">
            {gastosFiltrados.length} operaciones
          </h3>
          <div className="text-right">
            <span className="text-sm font-bold text-ink">{formatearMoneda(totalMes)}</span>
            {totalUSD > 0 && (
              <span className="ml-2 text-xs text-slate2">+ {formatearMoneda(totalUSD, 'USD')}</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist">
                <th className="text-left py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('fecha')} className="flex items-center hover:text-ink transition-colors">
                    Fecha<SortIcon field="fecha" />
                  </button>
                </th>
                <th className="text-left py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('descripcion')} className="flex items-center hover:text-ink transition-colors">
                    Descripción<SortIcon field="descripcion" />
                  </button>
                </th>
                <th className="hidden sm:table-cell text-left py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('rubro')} className="flex items-center hover:text-ink transition-colors">
                    Rubro<SortIcon field="rubro" />
                  </button>
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('monto')} className="flex items-center justify-end w-full hover:text-ink transition-colors">
                    Monto<SortIcon field="monto" />
                  </button>
                </th>
                <th className="hidden lg:table-cell text-center py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('formaPago')} className="flex items-center justify-center w-full hover:text-ink transition-colors">
                    Forma<SortIcon field="formaPago" />
                  </button>
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {gastosFiltrados.length > 0 ? (
                gastosFiltrados.map((g) => (
                  <tr key={g.id} className="hover:bg-paper/60 transition-colors">
                    <td className="py-3 px-2 text-xs text-slate2 whitespace-nowrap">
                      {formatearFecha(g.fecha)}
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-semibold text-ink">{g.descripcion}</p>
                      {g.detalle && <p className="text-xs text-slate2 italic">{g.detalle}</p>}
                    </td>
                    <td className="hidden sm:table-cell py-3 px-2">
                      <RubroDisplay rubro={g.rubroInfo} />
                    </td>
                    <td className={`py-3 px-2 text-right font-bold whitespace-nowrap ${g.monto < 0 ? 'text-brand' : 'text-ink'}`}>
                      {g.monto < 0
                        ? `+ ${formatearMoneda(Math.abs(g.monto))}`
                        : formatearMoneda(g.monto)
                      }
                    </td>
                    <td className="hidden lg:table-cell py-3 px-2 text-center">
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md ${obtenerPillClass(g)}`}>
                        {obtenerEtiquetaFormaPago(g)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setDatosIniciales({ descripcion: g.descripcion, detalle: g.detalle, monto: g.monto, fecha: g.fecha, rubroId: g.rubroId, rubro: g.rubro, formaPago: g.formaPago, tarjetaId: g.tarjetaId, cuentaId: g.cuentaId, cuotas: g.cuotas });
                            setMostrarFormulario(true);
                          }}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => abrirFormulario(g)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setGastoAEliminar(g)}
                          className="p-1.5 text-slate2 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate2">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-10 w-10 opacity-20" />
                      <p className="font-semibold text-ink">Sin registros</p>
                      <p className="text-xs">No hay gastos para el mes seleccionado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        {gastosFiltrados.length > 0 && (
          <div className="mt-4 pt-4 border-t border-mist flex justify-between items-center">
            <span className="text-sm text-slate2">Total del período</span>
            <div className="text-right">
              <span className="text-base font-black text-ink">{formatearMoneda(totalMes)}</span>
              {totalUSD > 0 && (
                <p className="text-xs text-slate2">{formatearMoneda(totalUSD, 'USD')}</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <ModalConfirmacion
        open={!!gastoAEliminar}
        title="Eliminar Gasto"
        message={`¿Eliminás el gasto "${gastoAEliminar?.descripcion}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={handleEliminar}
        onCancel={() => setGastoAEliminar(null)}
        onClose={() => setGastoAEliminar(null)}
      />

      {eliminando && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
          <Spinner className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}
