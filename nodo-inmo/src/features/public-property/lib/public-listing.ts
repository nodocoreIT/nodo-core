import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPortalPrice,
} from "@/features/portal/lib/portal-filters";
import type { PublicProperty } from "../hooks/use-public-property";

export function publicListingLocation(property: Pick<PublicProperty, "localidad" | "provincia" | "address">): string {
  return [property.localidad, property.provincia].filter(Boolean).join(", ");
}

export function publicListingTitle(property: Pick<PublicProperty, "property_type" | "operation" | "address">): string {
  const type = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const op = OPERATION_LABELS[property.operation] ?? property.operation;
  return `${type} en ${op} · ${property.address}`;
}

export function publicListingMapQuery(property: Pick<PublicProperty, "address" | "localidad" | "provincia">): string {
  return [property.address, property.localidad, property.provincia, "Argentina"]
    .filter(Boolean)
    .join(", ");
}

export function whatsappConsultHref(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function publicListingWhatsAppMessage(property: PublicProperty, pageUrl?: string): string {
  const price = formatPortalPrice(property.sale_price, property.currency);
  const lines = [`Hola, me interesa ${publicListingTitle(property)} (${price}).`];
  if (pageUrl) lines.push(pageUrl);
  return lines.join("\n");
}
