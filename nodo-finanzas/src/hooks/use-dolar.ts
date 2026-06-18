import { useCallback, useEffect, useState } from 'react';
import { FinanzasService } from '@/services/finanzas-service';
import type { CotizacionDolar, TipoDolar } from '@/types';

export const useDolar = () => {
  const [cotizacion, setCotizacion] = useState<CotizacionDolar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoDolarSeleccionado, setTipoDolarSeleccionado] = useState<TipoDolar>('blue');

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

  const obtenerCotizacion = async (tipo?: TipoDolar, forzarAPI = false) => {
    const tipoAUsar = tipo || tipoDolarSeleccionado;
    setLoading(true);
    setError(null);

    try {
      const nuevaCotizacion = await FinanzasService.obtenerCotizacionDolar(tipoAUsar, forzarAPI);
      setCotizacion(nuevaCotizacion);
      return nuevaCotizacion;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener cotización');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const cambiarTipoDolar = async (
    nuevoTipo: TipoDolar,
    cotizacionConocida?: CotizacionDolar | null,
  ) => {
    setTipoDolarSeleccionado(nuevoTipo);

    try {
      await FinanzasService.guardarConfiguracion('tipo_dolar_seleccionado', nuevoTipo);
    } catch (error) {
      console.error('Error guardando preferencia de dólar:', error);
    }

    if (cotizacionConocida && cotizacionConocida.tipo === nuevoTipo) {
      setCotizacion(cotizacionConocida);
      return cotizacionConocida;
    }

    return await obtenerCotizacion(nuevoTipo, true);
  };

  const sincronizarCotizaciones = useCallback(async (lista: CotizacionDolar[]) => {
    if (lista.length === 0) return;

    const selected =
      lista.find((c) => c.tipo === tipoDolarSeleccionado) ??
      lista.find((c) => c.tipo === 'blue') ??
      lista[0];

    setCotizacion((prev) => {
      if (
        prev?.tipo === selected.tipo &&
        prev.compra === selected.compra &&
        prev.venta === selected.venta
      ) {
        return prev;
      }
      return selected;
    });

    try {
      await FinanzasService.guardarCotizaciones(lista);
    } catch (error) {
      console.error('Error guardando cotizaciones:', error);
    }
  }, [tipoDolarSeleccionado]);

  useEffect(() => {
    if (tipoDolarSeleccionado) {
      obtenerCotizacion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDolarSeleccionado]);

  const convertirArsAUsd = (ars: number): number => {
    if (!cotizacion) return 0;
    return ars / cotizacion.venta;
  };

  const convertirUsdAArs = (usd: number): number => {
    if (!cotizacion) return 0;
    return usd * cotizacion.venta;
  };

  const convertirUSDaARS = convertirUsdAArs;
  const convertirARSaUSD = convertirArsAUsd;

  return {
    cotizacion,
    loading,
    error,
    tipoDolarSeleccionado,
    obtenerCotizacion,
    cambiarTipoDolar,
    sincronizarCotizaciones,
    convertirArsAUsd,
    convertirUsdAArs,
    convertirUSDaARS,
    convertirARSaUSD,
  };
};
