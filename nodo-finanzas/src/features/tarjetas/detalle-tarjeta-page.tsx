import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Search,
  X,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { MonthPicker } from '@/components/ui/month-picker';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { RubroSelector } from '@/components/rubros/rubro-selector';
import { useFinanzas } from '@/hooks/use-finanzas';
import { formatearFecha, getFechaHoy } from '@/utils/formatters';
import { ModalEditarConsumo } from './modal-editar-consumo';
import { RegistroConsumo } from './registro-consumo';
import toast from 'react-hot-toast';
import type { ConsumoTarjeta } from '@/types';

type SortField = 'fecha' | 'lugar' | 'rubro' | 'monto';
type SortDir = 'asc' | 'desc';

export function DetalleTarjetaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const finanzas = useFinanzas();

  const [filtroMes, setFiltroMes] = useState(getFechaHoy().slice(0, 7));
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState<string | null>(null);
  const [consumoEditando, setConsumoEditando] = useState<ConsumoTarjeta | null>(null);
  const [vistaRegistro, setVistaRegistro] = useState(false);
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const tarjeta = finanzas.tarjetas.find((t) => t.id === id);

  const consumosDelMes = useMemo(() => {
    if (!id) return [];
    return finanzas.consumosTarjetas.filter((c) => {
      const anioMes = new Date(c.fecha).toISOString().slice(0, 7);
      return c.tarjetaId === id && anioMes === filtroMes;
    });
  }, [finanzas.consumosTarjetas, id, filtroMes]);

  const consumosFiltrados = useMemo(() => {
    let list = consumosDelMes;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(
        (c) =>
          c.lugar.toLowerCase().includes(q) ||
          (c.detalle || '').toLowerCase().includes(q) ||
          (c.rubroInfo?.nombre || '').toLowerCase().includes(q)
      );
    }
    if (rubroFiltro) {
      list = list.filter((c) => c.rubroId === rubroFiltro);
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'fecha': cmp = a.fecha.localeCompare(b.fecha); break;
        case 'lugar': cmp = a.lugar.localeCompare(b.lugar, 'es'); break;
        case 'rubro': {
          const textOnly = (s: string) => s.replace(/^[^\p{L}]+/u, '');
          cmp = textOnly(a.rubroInfo?.nombre ?? '').localeCompare(textOnly(b.rubroInfo?.nombre ?? ''), 'es');
          break;
        }
        case 'monto': cmp = (a.importeARS || 0) - (b.importeARS || 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [consumosDelMes, busqueda, rubroFiltro, sortField, sortDir]);

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

  const totalARS = consumosDelMes.reduce((a, c) => a + (c.importeARS || 0), 0);
  const totalUSD = consumosDelMes.reduce((a, c) => a + (c.importeUSD || 0), 0);

  const formatearMesLabel = (fechaMes: string) => {
    const [anio, mes] = fechaMes.split('-');
    return new Date(parseInt(anio), parseInt(mes) - 1).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
  };

  const handleEliminar = async (consumo: ConsumoTarjeta) => {
    if (!window.confirm('¿Eliminar este consumo?')) return;
    try {
      await finanzas.eliminarConsumo(consumo.id);
      await finanzas.recargarConsumosTarjetas();
      toast.success('Consumo eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleSaveEdit = async () => {
    await finanzas.recargarConsumosTarjetas();
    setConsumoEditando(null);
  };

  if (finanzas.loading && !tarjeta) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!tarjeta) {
    return (
      <div className="p-6 text-center">
        <CreditCard className="w-12 h-12 text-slate2 mx-auto mb-3" />
        <p className="text-slate2">Tarjeta no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/tarjetas')}>
          Volver
        </Button>
      </div>
    );
  }

  if (vistaRegistro) {
    return (
      <RegistroConsumo
        tarjetaPreseleccionada={tarjeta}
        onVolver={() => setVistaRegistro(false)}
        onGastoRegistrado={async () => {
          await finanzas.recargarDatos(true);
          setVistaRegistro(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate2">
        <button
          onClick={() => navigate('/admin/tarjetas')}
          className="hover:text-brand transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
          Mis Tarjetas
        </button>
        <span>/</span>
        <span className="text-ink font-medium">{tarjeta.nombre}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand/10">
            <CreditCard className="w-8 h-8 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">{tarjeta.nombre}</h1>
            <p className="text-slate2">{tarjeta.banco} · {tarjeta.titular}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {totalARS > 0 && (
            <div className="bg-brand/5 px-4 py-2 rounded-xl border border-brand/20 text-right">
              <p className="text-xs text-brand font-bold uppercase tracking-wider">Total Mes</p>
              <p className="text-xl font-black text-brand">
                ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {totalUSD > 0 && (
            <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 text-right">
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">USD Mes</p>
              <p className="text-xl font-black text-blue-700">
                U$S {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <MonthPicker value={filtroMes} onChange={setFiltroMes} className="self-start" />

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
          <input
            type="text"
            placeholder="Buscar por lugar o detalle..."
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
        <Button
          variant="secondary"
          onClick={() => setVistaRegistro(true)}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Consumption list */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-ink">
            {consumosFiltrados.length} operaciones
          </h3>
          <div className="text-right">
            {totalARS > 0 && (
              <span className="text-sm font-bold text-ink">
                ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            )}
            {totalUSD > 0 && (
              <span className="ml-2 text-xs text-slate2">
                + USD {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
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
                  <button onClick={() => handleSort('lugar')} className="flex items-center hover:text-ink transition-colors">
                    Lugar<SortIcon field="lugar" />
                  </button>
                </th>
                <th className="text-left py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('rubro')} className="flex items-center hover:text-ink transition-colors">
                    Rubro<SortIcon field="rubro" />
                  </button>
                </th>
                <th className="text-center py-3 px-2 font-medium text-slate2">Cuotas</th>
                <th className="text-right py-3 px-2 font-medium text-slate2">
                  <button onClick={() => handleSort('monto')} className="flex items-center justify-end w-full hover:text-ink transition-colors">
                    Monto<SortIcon field="monto" />
                  </button>
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {consumosFiltrados.length > 0 ? (
                consumosFiltrados.map((consumo) => (
                  <tr key={consumo.id} className="hover:bg-paper/60 transition-colors">
                    <td className="py-3 px-2 text-xs text-slate2 whitespace-nowrap">
                      {formatearFecha(consumo.fecha)}
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-semibold text-ink">{consumo.lugar}</p>
                      {consumo.detalle && (
                        <p className="text-xs text-slate2 italic">{consumo.detalle}</p>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <RubroDisplay rubro={consumo.rubroInfo ?? null} />
                    </td>
                    <td className="py-3 px-2 text-center">
                      {consumo.cuotas && consumo.cuotas !== '1 de 1' ? (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                          {consumo.cuotas}
                        </span>
                      ) : consumo.gastoFijo ? (
                        <span className="text-brand font-bold text-lg" title="Gasto recurrente">∞</span>
                      ) : (
                        <span className="text-slate2">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-ink whitespace-nowrap">
                      {consumo.importeARS
                        ? `$${consumo.importeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : ''}
                      {consumo.importeUSD
                        ? `USD ${consumo.importeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : ''}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setConsumoEditando(consumo)}
                          className="p-1.5 text-slate2 hover:text-brand hover:bg-mist rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEliminar(consumo)}
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
                      <CreditCard className="h-10 w-10 opacity-20" />
                      <p className="font-semibold text-ink">Sin gastos registrados</p>
                      <p className="text-xs">No hay consumos para {formatearMesLabel(filtroMes)}.</p>
                      <Button onClick={() => setVistaRegistro(true)} className="mt-2">
                        <Plus className="w-4 h-4" />
                        Registrar Primer Gasto
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {consumosFiltrados.length > 0 && (
          <div className="mt-4 pt-4 border-t border-mist flex justify-between items-center">
            <span className="text-sm text-slate2">Total del período</span>
            <div className="text-right">
              {totalARS > 0 && (
                <span className="text-base font-black text-ink">
                  ${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              )}
              {totalUSD > 0 && (
                <p className="text-xs text-slate2">
                  USD {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <ModalEditarConsumo
        open={!!consumoEditando}
        consumo={consumoEditando}
        onSave={handleSaveEdit}
        onCancel={() => setConsumoEditando(null)}
      />
    </div>
  );
}
