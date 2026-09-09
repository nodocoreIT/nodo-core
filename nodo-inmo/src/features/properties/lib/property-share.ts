import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPortalPrice,
} from "@/features/portal/lib/portal-filters";

export type ShareableProperty = {
  address: string;
  operation: string;
  property_type: string;
  sale_price: number | null;
  currency: string;
  rooms?: number | null;
  bathrooms?: number | null;
  total_sqm?: number | null;
  description?: string | null;
  share_token?: string | null;
};

export function getPublicPropertyUrl(shareToken: string): string {
  const landing =
    (import.meta.env.VITE_NODO_LANDING_URL as string | undefined)?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${landing}/inmo/p/${shareToken}`;
}

export function buildPropertyShareText(
  property: ShareableProperty,
  options?: { publicUrl?: string },
): string {
  const op = OPERATION_LABELS[property.operation] ?? property.operation;
  const type = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const price = formatPortalPrice(property.sale_price, property.currency);
  const lines = [`🏠 ${property.address}`, `${type} en ${op} · ${price}`];

  if (property.rooms || property.total_sqm) {
    const parts: string[] = [];
    if (property.rooms) parts.push(`${property.rooms} amb.`);
    if (property.bathrooms) parts.push(`${property.bathrooms} baños`);
    if (property.total_sqm) parts.push(`${property.total_sqm} m²`);
    lines.push(`🛏 ${parts.join(" · ")}`);
  }

  if (property.description) lines.push(`\n${property.description}`);

  const url = options?.publicUrl ?? (property.share_token ? getPublicPropertyUrl(property.share_token) : "");
  if (url) {
    lines.push("");
    lines.push(`🔗 Ver propiedad: ${url}`);
  }

  return lines.join("\n");
}

export function openWhatsAppShare(text: string): void {
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
}
