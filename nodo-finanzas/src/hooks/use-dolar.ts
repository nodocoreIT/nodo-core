import { useState, useEffect } from 'react';
import { DolarService } from '@/services/dolar-service';
import { FinanzasService } from '@/services/finanzas-service';
import type { CotizacionDolar, TipoDolar } from '@/types';

export const useDolar = () => {
  const [cotizacion, setCotizacion] = useState<CotizacionDolar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoDolarSeleccionado, setTipoDolarSeleccionado] = useState<TipoDolar>('blue');

  // Cargar configuración inicial
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const tipo = await FinanzasService.obtenerConfiguracion('tipo_dolar_seleccionado');
        if (tipo) {
          setTipoDolarSeleccionado(tipo);
        }
      } catch (error) {
        console.error('Error cargando configuración dólar:', error);
      }
    };

    cargarConfiguracion();
  }, []);

  // Obtener cotización (primero intenta desde DB, luego API)
  const obtenerCotizacion = async (tipo?: TipoDolar, forzarAPI: boolean = false) => {
    const tipoAUsar = tipo || tipoDolarSeleccionado;
    setLoading(true);
    setError(null);

    try {
      let nuevaCotizacion: CotizacionDolar | null = null;

      if (!forzarAPI) {
        nuevaCotizacion = await FinanzasService.obtenerUltimaCotizacion(tipoAUsar);

        if (nuevaCotizacion) {
          const fechaCotizacion = new Date(nuevaCotizacion.fechaActualizacion);
          const hoy = new Date();
          const esMismaFecha = fechaCotizacion.toDateString() === hoy.toDateString();

          if (!esMismaFecha) {
            nuevaCotizacion = null;
          }
        }
      }

      if (!nuevaCotizacion) {
        nuevaCotizacion = await DolarService.obtenerCotizacion(tipoAUsar);

        if (nuevaCotizacion) {
          await FinanzasService.guardarCotizacion(nuevaCotizacion);
        }
      }

      setCotizacion(nuevaCotizacion);
      return nuevaCotizacion;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener cotización');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar tipo de dólar y obtener nueva cotización
  const cambiarTipoDolar = async (nuevoTipo: TipoDolar) => {
    setTipoDolarSeleccionado(nuevoTipo);

    try {
      await FinanzasService.guardarConfiguracion('tipo_dolar_seleccionado', nuevoTipo);
    } catch (error) {
      console.error('Error guardando preferencia de dólar:', error);
    }

    return await obtenerCotizacion(nuevoTipo);
  };

  // Obtener cotización inicial
  useEffect(() => {
    if (tipoDolarSeleccionado) {
      obtenerCotizacion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDolarSeleccionado]);

  // Convertir de ARS a USD
  const convertirArsAUsd = (ars: number): number => {
    if (!cotizacion) return 0;
    return ars / cotizacion.venta;
  };

  // Convertir de USD a ARS
  const convertirUsdAArs = (usd: number): number => {
    if (!cotizacion) return 0;
    return usd * cotizacion.venta;
  };

  // Alias para compatibilidad
  const convertirUSDaARS = convertirUsdAArs;
  const convertirARSaUSD = convertirArsAUsd;

  return {
    cotizacion,
    loading,
    error,
    tipoDolarSeleccionado,
    obtenerCotizacion,
    cambiarTipoDolar,
    convertirArsAUsd,
    convertirUsdAArs,
    convertirUSDaARS,
    convertirARSaUSD,
  };
};
