export { cn } from "@nodocore/shared-components";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy · HH:mm 'hs'", { locale: es });
}

export function formatPrice(amount: number, currency: 'ARS' | 'USD'): string {
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return currency === 'USD' ? `USD ${formatted}` : `$ ${formatted}`;
}

export function formatKilometers(km: number): string {
  return `${km.toLocaleString('es-AR')} km`;
}

/**
 * Generates a unique slug for a vehicle based on brand, model, and license plate.
 */
export function generateVehicleSlug(vehicle: { brand: string; model: string; licensePlate?: string }): string {
  const base = `${vehicle.brand}${vehicle.model}${vehicle.licensePlate ? '-' + vehicle.licensePlate : '-' + Date.now()}`;
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
