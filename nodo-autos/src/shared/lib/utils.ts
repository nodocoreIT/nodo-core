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

/** Strips spaces/punctuation so "AC 456 EF" and "ac456ef" compare equal. */
export function normalizePlateSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function matchesPlateSearch(plate: string | undefined | null, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (!plate) return false;
  const lowerPlate = plate.toLowerCase();
  const lowerQuery = q.toLowerCase();
  if (lowerPlate.includes(lowerQuery)) return true;
  const normalizedQuery = normalizePlateSearch(q);
  if (!normalizedQuery) return false;
  return normalizePlateSearch(plate).includes(normalizedQuery);
}

export function matchesVehicleSearch(
  vehicle: {
    brand: string;
    model: string;
    version?: string;
    year: number;
    licensePlate?: string;
  },
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  const lower = q.toLowerCase();
  if (
    vehicle.brand.toLowerCase().includes(lower) ||
    vehicle.model.toLowerCase().includes(lower) ||
    (vehicle.version ?? "").toLowerCase().includes(lower) ||
    String(vehicle.year).includes(lower)
  ) {
    return true;
  }
  return matchesPlateSearch(vehicle.licensePlate, q);
}
