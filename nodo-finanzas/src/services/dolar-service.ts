import type { CotizacionDolar, TipoDolar } from '@/types';

const DOLAR_API_BASE = 'https://dolarapi.com/v1/dolares';

// Mapeo de tipos de dólar a endpoints de la API
const TIPO_DOLAR_ENDPOINTS: Record<TipoDolar, string> = {
  oficial: `${DOLAR_API_BASE}/oficial`,
  blue: `${DOLAR_API_BASE}/blue`,
  tarjeta: `${DOLAR_API_BASE}/tarjeta`,
  mep: `${DOLAR_API_BASE}/bolsa`,
  ccl: `${DOLAR_API_BASE}/contadoconliqui`,
};

export class DolarService {
  /**
   * Obtiene la cotización de un tipo específico de dólar
   */
  static async obtenerCotizacion(tipo: TipoDolar): Promise<CotizacionDolar> {
    try {
      const response = await fetch(TIPO_DOLAR_ENDPOINTS[tipo]);

      if (!response.ok) {
        throw new Error(`Error al obtener cotización: ${response.status}`);
      }

      const data = await response.json();

      return {
        tipo,
        compra: Math.round(data.compra || 0),
        venta: Math.round(data.venta || 0),
        fechaActualizacion: data.fechaActualizacion || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching dolar rate:', error);
      throw new Error('No se pudo obtener la cotización del dólar');
    }
  }

  /**
   * Obtiene todas las cotizaciones disponibles
   */
  static async obtenerTodasLasCotizaciones(): Promise<CotizacionDolar[]> {
    try {
      const response = await fetch(DOLAR_API_BASE);

      if (!response.ok) {
        throw new Error(`Error al obtener cotizaciones: ${response.status}`);
      }

      const data = await response.json();

      return data.map((item: any) => ({
        tipo: this.mapearTipoDolar(item.nombre),
        compra: Math.round(item.compra || 0),
        venta: Math.round(item.venta || 0),
        fechaActualizacion: item.fechaActualizacion || new Date().toISOString(),
      })).filter((cotizacion: CotizacionDolar) => cotizacion.tipo !== null);
    } catch (error) {
      console.error('Error fetching all dolar rates:', error);
      throw new Error('No se pudo obtener las cotizaciones del dólar');
    }
  }

  /**
   * Mapea el nombre de la API al tipo de dólar
   */
  private static mapearTipoDolar(nombre: string): TipoDolar | null {
    const nombreLower = nombre.toLowerCase();

    if (nombreLower.includes('oficial')) return 'oficial';
    if (nombreLower.includes('blue')) return 'blue';
    if (nombreLower.includes('tarjeta')) return 'tarjeta';
    if (nombreLower.includes('bolsa') || nombreLower.includes('mep')) return 'mep';
    if (nombreLower.includes('contado') || nombreLower.includes('ccl')) return 'ccl';

    return null;
  }

  /**
   * Convierte un monto de USD a ARS usando la cotización
   */
  static convertirUSDaARS(montoUSD: number, cotizacion: CotizacionDolar): number {
    return montoUSD * cotizacion.venta;
  }

  /**
   * Convierte un monto de ARS a USD usando la cotización
   */
  static convertirARSaUSD(montoARS: number, cotizacion: CotizacionDolar): number {
    return montoARS / cotizacion.compra;
  }
}
