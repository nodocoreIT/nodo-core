export { cn } from "@nodocore/shared-components";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH:mm 'hs'", { locale: es });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy · HH:mm 'hs'", { locale: es });
}
