import { useState, useEffect } from 'react';
import { FinanzasService } from '@/services/finanzas-service';
import { useAuth } from '@/shared/hooks/use-auth';
import type { Rubro } from '@/types';

interface UseRubrosReturn {
  rubros: Rubro[];
  rubrosActivos: Rubro[];
  loading: boolean;
  error: string | null;
  recargarRubros: () => Promise<void>;
  crearRubro: (rubro: Omit<Rubro, 'id'>) => Promise<Rubro | null>;
  actualizarRubro: (id: string, rubro: Partial<Omit<Rubro, 'id'>>) => Promise<boolean>;
  eliminarRubro: (id: string) => Promise<boolean>;
  eliminarRubrosInactivos: () => Promise<number>;
  obtenerRubroPorId: (id: string) => Rubro | undefined;
}

export const useRubros = (): UseRubrosReturn => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarRubros = async () => {
    try {
      setLoading(true);
      setError(null);
      const rubrosData = await FinanzasService.obtenerRubros();
      setRubros(rubrosData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error cargando rubros:', err);
    } finally {
      setLoading(false);
    }
  };

  const crearRubro = async (nuevoRubro: Omit<Rubro, 'id'>): Promise<Rubro | null> => {
    try {
      setError(null);
      const rubroCreado = await FinanzasService.crearRubro(nuevoRubro);

      if (rubroCreado) {
        setRubros(prev => [...prev, rubroCreado]);
        return rubroCreado;
      }

      setError('Error al crear el rubro');
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error creando rubro:', err);
      return null;
    }
  };

  const actualizarRubro = async (
    id: string,
    datosActualizacion: Partial<Omit<Rubro, 'id'>>
  ): Promise<boolean> => {
    try {
      setError(null);
      const exito = await FinanzasService.actualizarRubro(id, datosActualizacion);

      if (exito) {
        setRubros(prev =>
          prev.map(rubro =>
            rubro.id === id ? { ...rubro, ...datosActualizacion } : rubro
          )
        );
        return true;
      }

      setError('Error al actualizar el rubro');
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error actualizando rubro:', err);
      return false;
    }
  };

  const eliminarRubro = async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const exito = await FinanzasService.eliminarRubro(id);

      if (exito) {
        setRubros(prev => prev.filter(rubro => rubro.id !== id));
        return true;
      }

      setError('Error al eliminar el rubro');
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error eliminando rubro:', err);
      return false;
    }
  };

  const eliminarRubrosInactivos = async (): Promise<number> => {
    try {
      setError(null);
      const n = await FinanzasService.eliminarRubrosInactivos();
      if (n > 0) {
        await cargarRubros();
      }
      return n;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error eliminando rubros inactivos:', err);
      return 0;
    }
  };

  const obtenerRubroPorId = (id: string): Rubro | undefined => {
    return rubros.find(rubro => rubro.id === id);
  };

  const recargarRubros = async (): Promise<void> => {
    await cargarRubros();
  };

  // Cargar rubros al montar el componente
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void cargarRubros();
  }, [userId]);

  // Filtrar solo rubros activos
  const rubrosActivos = rubros.filter(rubro => rubro.activo);

  return {
    rubros,
    rubrosActivos,
    loading,
    error,
    recargarRubros,
    crearRubro,
    actualizarRubro,
    eliminarRubro,
    eliminarRubrosInactivos,
    obtenerRubroPorId
  };
};
