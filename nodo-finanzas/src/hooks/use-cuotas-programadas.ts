import { useState, useEffect } from 'react';
import { FinanzasService } from '@/services/finanzas-service';
import type { CuotaProgramada } from '@/types';

export const useCuotasProgramadas = (prestamoId?: string) => {
  const [cuotas, setCuotas] = useState<CuotaProgramada[]>([]);
  const [cuotaActual, setCuotaActual] = useState<CuotaProgramada | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCuotas = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const cuotasData = await FinanzasService.obtenerCuotasPorPrestamo(id);
      setCuotas(cuotasData);

      const actual = await FinanzasService.obtenerCuotaActual(id);
      setCuotaActual(actual);
    } catch (err) {
      setError('Error cargando cuotas programadas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const crearCuotas = async (nuevasCuotas: Omit<CuotaProgramada, 'id'>[]) => {
    setLoading(true);
    setError(null);
    try {
      const cuotasCreadas = await FinanzasService.crearCuotas(nuevasCuotas);
      if (prestamoId) {
        await cargarCuotas(prestamoId);
      }
      return cuotasCreadas;
    } catch (err) {
      setError('Error creando cuotas');
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const marcarComoPagada = async (cuotaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const fechaPago = new Date().toISOString().split('T')[0];
      const success = await FinanzasService.marcarCuotaComoPagada(cuotaId, fechaPago);

      if (success && prestamoId) {
        await cargarCuotas(prestamoId);
      }

      return success;
    } catch (err) {
      setError('Error marcando cuota como pagada');
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const actualizarCuota = async (cuotaId: string, cambios: Partial<CuotaProgramada>) => {
    setLoading(true);
    setError(null);
    try {
      const success = await FinanzasService.actualizarCuota(cuotaId, cambios);

      if (success && prestamoId) {
        await cargarCuotas(prestamoId);
      }

      return success;
    } catch (err) {
      setError('Error actualizando cuota');
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const eliminarCuotas = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const success = await FinanzasService.eliminarCuotasPorPrestamo(id);
      if (success && id === prestamoId) {
        setCuotas([]);
        setCuotaActual(null);
      }
      return success;
    } catch (err) {
      setError('Error eliminando cuotas');
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prestamoId) {
      cargarCuotas(prestamoId);
    }
  }, [prestamoId]);

  return {
    cuotas,
    cuotaActual,
    loading,
    error,
    cargarCuotas,
    crearCuotas,
    marcarComoPagada,
    actualizarCuota,
    eliminarCuotas
  };
};
