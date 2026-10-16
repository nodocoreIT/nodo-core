import type { CSSProperties } from "react";
import { mergeThemeSettings } from "@nodocore/shared-components";
import { DEFAULT_SETTINGS, type ThemeSettings } from "@/shared/hooks/use-theme-settings";
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

export function publicListingTheme(property: PublicProperty): ThemeSettings {
  return mergeThemeSettings(property.theme_settings, DEFAULT_SETTINGS);
}

export function publicListingThemeStyle(theme: ThemeSettings): CSSProperties {
  return {
    ["--color-brand" as string]: theme.primaryColor,
    ["--color-brand-600" as string]: theme.primaryColor,
    ["--color-brand-300" as string]: theme.primaryColor,
    ["--color-navy" as string]: theme.secondaryColor,
    ["--color-navy-700" as string]: theme.secondaryColor,
    ["--color-navy-900" as string]: theme.secondaryColor,
    ["--color-primary" as string]: theme.primaryColor,
    ["--color-ink" as string]: theme.fontColor,
    ["--color-foreground" as string]: theme.fontColor,
    ["--color-paper" as string]: theme.backgroundColor || "#f5f8fc",
  };
}
