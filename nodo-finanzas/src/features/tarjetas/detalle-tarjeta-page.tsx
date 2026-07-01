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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { MonthPicker } from '@/components/ui/month-picker';
import { RubroDisplay } from '@/components/rubros/rubro-display';
import { useFinanzas } from '@/hooks/use-finanzas';
import { formatearFecha, getFechaHoy } from '@/utils/formatters';
import { ModalEditarConsumo } from './modal-editar-consumo';
import { RegistroConsumo } from './registro-consumo';
import toast from 'react-hot-toast';
import type { ConsumoTarjeta } from '@/types';

export function DetalleTarjetaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const finanzas = useFinanzas();

  const [filtroMes, setFiltroMes] = useState(getFechaHoy().slice(0, 7));
  const [busqueda, setBusqueda] = useState('');
  const [consumoEditando, setConsumoEditando] = useState<ConsumoTarjeta | null>(null);
  const [vistaRegistro, setVistaRegistro] = useState(false);

  const tarjeta = finanzas.tarjetas.find((t) => t.id === id);

  const consumosDelMes = useMemo(() => {
    if (!id) return [];
    return finanzas.consumosTarjetas.filter((c) => {
      const anioMes = new Date(c.fecha).toISOString().slice(0, 7);
      return c.tarjetaId === id && anioMes === filtroMes;
    });
  }, [finanzas.consumosTarjetas, id, filtroMes]);

  const consumosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return consumosDelMes;
    const q = busqueda.toLowerCase();
    return consumosDelMes.filter(
      (c) =>
        c.lugar.toLowerCase().includes(q) ||
        (c.detalle || '').toLowerCase().includes(q) ||
        (c.rubroInfo?.nombre || '').toLowerCase().includes(q)
    );
  }, [consumosDelMes, busqueda]);

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

  const handleSaveEdit = async (cambios: Partial<ConsumoTarjeta>) => {
    if (!consumoEditando) return;
    try {
      await finanzas.actualizarConsumo(consumoEditando.id, { tarjetaId: consumoEditando.tarjetaId, ...cambios });
      await finanzas.recargarConsumosTarjetas();
      setConsumoEditando(null);
      toast.success('Consumo actualizado');
    } catch {
      toast.error('Error al actualizar');
    }
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
          <Button onClick={() => setVistaRegistro(true)}>
            <Plus className="w-4 h-4" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-mist px-3 py-2.5 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative w-full sm:max-w-xs sm:flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate2" />
          <input
            type="text"
            placeholder="Buscar por lugar o detalle..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-9 w-full rounded-lg border border-mist bg-white pl-8 pr-8 text-sm text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate2 hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <MonthPicker
            value={filtroMes}
            onChange={setFiltroMes}
            className="border-0 shadow-none bg-transparent py-0 px-0"
          />
          <span className="text-xs text-slate2 font-medium whitespace-nowrap">
            {consumosFiltrados.length} resultado{consumosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Consumption list */}
      <div className="bg-white rounded-xl shadow-sm border border-mist p-5">
        <h2 className="text-lg font-bold text-ink mb-5">
          Historial — <span className="capitalize">{formatearMesLabel(filtroMes)}</span>
        </h2>

        {consumosFiltrados.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">💳</div>
            <p className="text-ink font-medium mb-1">Sin gastos registrados</p>
            <p className="text-slate2 text-sm mb-4">
              No hay consumos para {formatearMesLabel(filtroMes)}.
            </p>
            <Button onClick={() => setVistaRegistro(true)}>
              <Plus className="w-4 h-4" />
              Registrar Primer Gasto
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper border-b border-mist">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate2">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate2">Lugar</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate2">Rubro</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate2">Cuotas</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate2">Monto</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {consumosFiltrados
                  .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                  .map((consumo) => (
                    <tr key={consumo.id} className="hover:bg-paper/50 transition-colors">
                      <td className="px-4 py-3 text-slate2 whitespace-nowrap">
                        {formatearFecha(consumo.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{consumo.lugar}</div>
                        {consumo.detalle && (
                          <div className="text-xs text-slate2 truncate max-w-[200px]">
                            {consumo.detalle}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RubroDisplay rubro={consumo.rubroInfo ?? null} />
                      </td>
                      <td className="px-4 py-3 text-center">
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
                      <td className="px-4 py-3 text-right font-bold text-ink whitespace-nowrap">
                        {consumo.importeARS
                          ? `$${consumo.importeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          : ''}
                        {consumo.importeUSD
                          ? `USD ${consumo.importeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : ''}
                      </td>
                      <td className="px-4 py-3">
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
                  ))}
              </tbody>
              <tfoot className="border-t-2 border-mist">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate2 text-right">
                    Total del período:
                  </td>
                  <td className="px-4 py-3 text-right font-black text-ink">
                    {totalARS > 0 && (
                      <div>${totalARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                    )}
                    {totalUSD > 0 && (
                      <div className="text-blue-700">
                        USD {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <ModalEditarConsumo
        open={!!consumoEditando}
        consumo={consumoEditando}
        onSave={handleSaveEdit}
        onCancel={() => setConsumoEditando(null)}
      />
    </div>
  );
}
