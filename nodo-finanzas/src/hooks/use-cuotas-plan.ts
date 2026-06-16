import { useState, useEffect, useCallback } from 'react';
import { FinanzasService } from '@/services/finanzas-service';
import type { CuotaPlanAhorro } from '@/types';

export const useCuotasPlan = (planId?: string) => {
  const [cuotas, setCuotas] = useState<CuotaPlanAhorro[]>([]);
  const [proximaCuota, setProximaCuota] = useState<CuotaPlanAhorro | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCuotas = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const cuotasData = await FinanzasService.obtenerCuotasPorPlan(id);
      setCuotas(cuotasData);

      const proxima = await FinanzasService.obtenerProximaCuotaPlanAhorro(id);
      setProximaCuota(proxima);
    } catch (err) {
      setError('Error cargando cuotas del plan de ahorro');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const crearCuotas = async (nuevasCuotas: Omit<CuotaPlanAhorro, 'id'>[]) => {
    setLoading(true);
    setError(null);
    try {
      const cuotasCreadas = await FinanzasService.crearCuotasPlan(nuevasCuotas);
      if (planId) {
        await cargarCuotas(planId);
      }
      return cuotasCreadas;
    } catch (err) {
      setError('Error creando cuotas de plan');
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const marcarComoPagada = async (cuotaId: string, gastoDiarioId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const fechaPago = new Date().toISOString().split('T')[0];
      const success = await FinanzasService.marcarCuotaPlanComoPagada(cuotaId, fechaPago, gastoDiarioId);

      if (success && planId) {
        await cargarCuotas(planId);
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

  const actualizarCuota = async (cuotaId: string, cambios: Partial<CuotaPlanAhorro>) => {
    setLoading(true);
    setError(null);
    try {
      const success = await FinanzasService.actualizarCuotaPlan(cuotaId, cambios);

      if (success && planId) {
        await cargarCuotas(planId);
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
      const success = await FinanzasService.eliminarCuotasPorPlan(id);
      if (success && id === planId) {
        setCuotas([]);
        setProximaCuota(null);
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
    if (planId) {
      cargarCuotas(planId);
    }
  }, [planId, cargarCuotas]);

  return {
    cuotas,
    proximaCuota,
    loading,
    error,
    cargarCuotas,
    crearCuotas,
    marcarComoPagada,
    actualizarCuota,
    eliminarCuotas
  };
};
