import { useState, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Receipt, X } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { formatearMoneda, formatearFecha } from '@/utils/formatters';
import type { GastoDiario } from '@/types';

export function GastosDiariosPage() {
  const finanzas = useFinanzas();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<GastoDiario | null>(null);
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

    return [...list].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [finanzas.gastosDiarios, filtroMes, busqueda, rubroFiltro]);

  const totalMes = gastosFiltrados.reduce((s, g) => s + g.monto, 0);
  const totalUSD = gastosFiltrados.filter((g) => g.montoUSD && g.montoUSD > 0)
    .reduce((s, g) => s + (g.montoUSD ?? 0), 0);

  function abrirFormulario(gasto?: GastoDiario) {
    setGastoEditando(gasto ?? null);
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setGastoEditando(null);
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

  function obtenerEtiquetaFormaPago(g: GastoDiario): string {
    if (g.formaPago === 'TARJETA' && g.tarjetaId) {
      const t = finanzas.tarjetas.find((t) => t.id === g.tarjetaId);
      return t ? `T. ${t.nombre}` : 'Tarjeta';
    }
    const map: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      DEBITO: 'Débito',
      MERCADO_PAGO: 'Mercado Pago',
      'TRANSFERENCIA BANCO': 'Transferencia',
    };
    return map[g.formaPago] ?? g.formaPago;
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

      {/* Add button */}
      <Button onClick={() => abrirFormulario()} className="w-full">
        <Plus className="h-4 w-4" />
        Nuevo Gasto Diario
      </Button>

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
                <th className="text-left py-3 px-2 font-medium text-slate2">Fecha</th>
                <th className="text-left py-3 px-2 font-medium text-slate2">Descripción</th>
                <th className="hidden sm:table-cell text-left py-3 px-2 font-medium text-slate2">Rubro</th>
                <th className="text-right py-3 px-2 font-medium text-slate2">Monto</th>
                <th className="hidden lg:table-cell text-center py-3 px-2 font-medium text-slate2">Forma</th>
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
                      <span className="text-[9px] font-bold uppercase bg-mist text-slate2 px-2 py-1 rounded-md">
                        {obtenerEtiquetaFormaPago(g)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
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
