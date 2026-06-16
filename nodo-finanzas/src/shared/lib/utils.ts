import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy · HH:mm 'hs'", { locale: es });
}

export function formatCurrency(amount: number, currency: "ARS" | "USD" = "ARS"): string {
  const formatted = amount.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return currency === "USD" ? `USD ${formatted}` : `$ ${formatted}`;
}
