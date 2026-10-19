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

/** Splits "2954586125 / 2954362150" (or similar) into one number per phone. */
export function parseAgencyPhones(phone: string | null | undefined): string[] {
  if (!phone?.trim()) return [];
  const fromSeparators = phone
    .split(/[/|,;]+|\s+y\s+|\s+e\s+/i)
    .map((part) => part.replace(/\D/g, ""))
    .filter((digits) => digits.length >= 8);
  if (fromSeparators.length > 1) return [...new Set(fromSeparators)];
  const all = phone.replace(/\D/g, "");
  if (all.length >= 16 && all.length % 10 === 0) {
    const chunks: string[] = [];
    for (let i = 0; i < all.length; i += 10) chunks.push(all.slice(i, i + 10));
    return chunks.filter((d) => d.length >= 8);
  }
  if (all.length >= 8) return [fromSeparators[0] ?? all];
  return [];
}

/** Argentina WhatsApp ids: 10 local digits → 549… so iOS doesn’t treat them as @usernames. */
export function toWhatsAppNumber(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length < 8) return d;
  if (d.startsWith("54") && d.length >= 12) {
    if (d.length === 12 && !d.startsWith("549")) return `549${d.slice(2)}`;
    return d;
  }
  if (d.startsWith("9") && d.length >= 11) return `54${d}`;
  if (d.length === 10) return `549${d}`;
  if (d.length >= 8 && !d.startsWith("54")) return `54${d}`;
  return d;
}

export function whatsappConsultHref(phone: string | null | undefined, message: string): string | null {
  const first = parseAgencyPhones(phone)[0];
  if (!first) return null;
  const id = toWhatsAppNumber(first);
  return `https://api.whatsapp.com/send?phone=${id}&text=${encodeURIComponent(message)}`;
}

export function publicListingWhatsAppMessage(property: PublicProperty, pageUrl?: string): string {
  const price = formatPortalPrice(property.sale_price, property.currency);
  const lines = [`Hola, me interesa ${publicListingTitle(property)} (${price}).`];
  if (pageUrl) lines.push(pageUrl);
  return lines.join("\n");
}

export function coerceThemeSettings(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return coerceThemeSettings(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.primaryColor === "string" && obj.primaryColor.length > 3) return obj;
  return Object.keys(obj).length > 0 ? obj : null;
}

export function themeFromShareQuery(search: string): Record<string, unknown> | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const pc = params.get("pc");
  const sc = params.get("sc");
  if (!pc && !sc) return null;
  const out: Record<string, unknown> = {};
  if (pc) out.primaryColor = pc.startsWith("#") ? pc : `#${pc}`;
  if (sc) out.secondaryColor = sc.startsWith("#") ? sc : `#${sc}`;
  return out;
}

export function publicListingTheme(property: PublicProperty, search?: string): ThemeSettings {
  const fromProperty = coerceThemeSettings(property.theme_settings);
  const fromQuery = search ? themeFromShareQuery(search) : null;
  const fromWindow =
    typeof window !== "undefined"
      ? coerceThemeSettings((window as Window & { __NODO_FLYER_THEME__?: unknown }).__NODO_FLYER_THEME__)
      : null;
  return mergeThemeSettings({ ...fromQuery, ...fromWindow, ...fromProperty }, DEFAULT_SETTINGS);
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
    ["--flyer-primary" as string]: theme.primaryColor,
    ["--flyer-secondary" as string]: theme.secondaryColor,
  };
}
