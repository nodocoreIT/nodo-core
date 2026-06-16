import type { Moneda } from '@/types';

/**
 * Formatea un número como moneda
 */
export const formatearMoneda = (monto: number, moneda: Moneda = 'ARS'): string => {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(monto);
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(monto);
};

/**
 * Formatea un número sin símbolo de moneda
 */
export const formatearNumero = (numero: number, decimales: number = 2): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
};

/**
 * Formatea una fecha
 */
export const formatearFecha = (fecha: string | Date, formato: 'corto' | 'largo' | 'completo' = 'corto'): string => {
  let date: Date;

  if (typeof fecha === 'string') {
    // Para evitar problemas de zona horaria, parseamos manualmente si es string YYYY-MM-DD
    if (fecha.includes('-') && fecha.length === 10) {
      const [year, month, day] = fecha.split('-').map(Number);
      date = new Date(year, month - 1, day); // month es 0-based en JavaScript
    } else {
      date = new Date(fecha);
    }
  } else {
    date = fecha;
  }

  if (formato === 'completo') {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const formateada = new Intl.DateTimeFormat('es-AR', options).format(date);
    // Capitalizar la primera letra (el día de la semana)
    return formateada.charAt(0).toUpperCase() + formateada.slice(1);
  }

  if (formato === 'largo') {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('es-AR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Convierte una fecha a string ISO para inputs de tipo date
 */
export const fechaParaInput = (fecha: string | Date): string => {
  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return date.toISOString().split('T')[0];
};

/**
 * Obtiene la fecha actual en diferentes formatos
 */
export const obtenerFechaActual = (formato: 'iso' | 'input' | 'display' = 'iso'): string => {
  const ahora = new Date();

  switch (formato) {
    case 'iso':
      return ahora.toISOString();
    case 'input':
      return ahora.toISOString().slice(0, 10);
    case 'display':
      return formatearFecha(ahora);
    default:
      return ahora.toISOString();
  }
};

/**
 * Función para obtener la fecha actual en formato YYYY-MM-DD en timezone local
 */
export const getFechaHoy = (): string => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

/**
 * Obtiene el primer y último día del mes actual
 */
export const obtenerRangoMesActual = (): { inicio: string; fin: string } => {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  };
};

/**
 * Valida si una fecha está en el mes actual
 */
export const esFechaDelMesActual = (fecha: string): boolean => {
  if (!fecha) return false;
  // Si la fecha es YYYY-MM-DD, la comparamos directamente con el mes actual
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  return fecha.startsWith(mesActual);
};

/**
 * Parsea las cuotas de un string (ej: "2 de 3" -> { actual: 2, total: 3 })
 */
export const parsearCuotas = (cuotasStr: string): { actual: number; total: number } | null => {
  const regex = /(\d+)\s*de\s*(\d+)/i;
  const match = cuotasStr.match(regex);

  if (match) {
    return {
      actual: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
    };
  }

  return null;
};

/**
 * Formatea las cuotas para mostrar
 */
export const formatearCuotas = (cuotaActual: number, totalCuotas: number): string => {
  return `${cuotaActual} de ${totalCuotas}`;
};

/**
 * Calcula el porcentaje entre dos números
 */
export const calcularPorcentaje = (parte: number, total: number): number => {
  if (total === 0) return 0;
  return (parte / total) * 100;
};

/**
 * Trunca un texto a una longitud específica
 */
export const truncarTexto = (texto: string, longitud: number = 30): string => {
  if (texto.length <= longitud) return texto;
  return texto.substring(0, longitud) + '...';
};

/**
 * Genera un ID único
 */
export const generarId = (): string => {
  return crypto.randomUUID();
};

/**
 * Valida si un número es positivo
 */
export const esNumeroPositivo = (numero: number): boolean => {
  return !isNaN(numero) && numero > 0;
};

/**
 * Convierte un string a número de forma segura
 */
export const parseFloatSeguro = (valor: string): number => {
  const numero = parseFloat(valor);
  return isNaN(numero) ? 0 : numero;
};
