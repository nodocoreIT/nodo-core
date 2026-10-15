import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FinanzasService } from '@/services/finanzas-service';

export interface CobroPendiente {
  id: string;
  concepto: string;
  monto: number;
}

const CLAVE = 'cobros_pendientes';

function esCobro(value: unknown): value is CobroPendiente {
  if (!value || typeof value !== 'object') return false;
  const row = value as CobroPendiente;
  return typeof row.id === 'string' && typeof row.concepto === 'string' && Number.isFinite(row.monto);
}

export function useCobrosPendientes() {
  const [items, setItems] = useState<CobroPendiente[]>([]);

  useEffect(() => {
    let cancel = false;
    FinanzasService.obtenerConfiguracion(CLAVE)
      .then((valor) => {
        if (cancel || !Array.isArray(valor)) return;
        setItems(valor.filter(esCobro));
      })
      .catch((error) => {
        console.error('Error cargando cobros pendientes:', error);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const guardar = useCallback(async (next: CobroPendiente[]) => {
    const previo = items;
    setItems(next);
    try {
      await FinanzasService.guardarConfiguracion(CLAVE, next);
    } catch (error) {
      console.error('Error guardando cobros pendientes:', error);
      setItems(previo);
      toast.error('No se pudo guardar lo que falta cobrar');
    }
  }, [items]);

  return { items, guardar };
}
