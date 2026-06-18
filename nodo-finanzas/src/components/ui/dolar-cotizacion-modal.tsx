import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DolarService } from '@/services/dolar-service';
import type { CotizacionDolar, TipoDolar } from '@/types';
import { formatearFecha } from '@/utils/formatters';

const TIPO_LABELS: Record<TipoDolar, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  tarjeta: 'Tarjeta',
  mep: 'MEP',
  ccl: 'CCL',
};

const TIPO_ORDER: TipoDolar[] = ['blue', 'oficial', 'tarjeta', 'mep', 'ccl'];

interface DolarCotizacionModalProps {
  open: boolean;
  onClose: () => void;
  tipoSeleccionado: TipoDolar;
  onSelectTipo?: (tipo: TipoDolar, cotizacion?: CotizacionDolar) => void;
  onCotizacionesLoaded?: (cotizaciones: CotizacionDolar[]) => void;
}

export function DolarCotizacionModal({
  open,
  onClose,
  tipoSeleccionado,
  onSelectTipo,
  onCotizacionesLoaded,
}: DolarCotizacionModalProps) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionDolar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const onLoadedRef = useRef(onCotizacionesLoaded);

  onLoadedRef.current = onCotizacionesLoaded;

  const cargar = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await DolarService.obtenerTodasLasCotizaciones();
      setCotizaciones(data);
      onLoadedRef.current?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener cotizaciones');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setCotizaciones([]);
      setError(null);
      return;
    }
    void cargar();
  }, [open, cargar]);

  if (!open) return null;

  const ordenadas = [...cotizaciones].sort(
    (a, b) => TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo),
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-mist">
          <div>
            <h2 className="text-lg font-bold text-ink">Cotización del dólar</h2>
            <p className="text-xs text-slate2 mt-0.5">Fuente: dolarapi.com</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate2 hover:bg-mist hover:text-navy transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && cotizaciones.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-slate2">Cargando cotizaciones...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && ordenadas.length === 0 && (
            <p className="text-sm text-slate2 text-center py-8">No hay cotizaciones disponibles.</p>
          )}

          {ordenadas.map((c) => {
            const selected = c.tipo === tipoSeleccionado;
            return (
              <button
                key={c.tipo}
                type="button"
                onClick={() => onSelectTipo?.(c.tipo, c)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected
                    ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                    : 'border-mist bg-mist/30 hover:border-brand/40 hover:bg-brand/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate2">
                    {TIPO_LABELS[c.tipo]}
                  </p>
                  {selected && (
                    <span className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                      Referencia
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <div>
                    <p className="text-[10px] text-slate2">Compra</p>
                    <p className="text-base font-black text-ink">${c.compra.toLocaleString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate2">Venta</p>
                    <p className="text-base font-black text-brand">${c.venta.toLocaleString('es-AR')}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate2 mt-2">
                  Actualizado: {formatearFecha(c.fechaActualizacion)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-mist bg-paper/50">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="primary" className="flex-1" loading={loading} onClick={cargar}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>
    </div>
  );
}
