import { PROVINCIAS, type Provincia } from "@/lib/clinic/argentina-geo";

export function formatDoctorLocation(
  city?: string | null,
  province?: string | null,
): string {
  const c = city?.trim() ?? "";
  const p = province?.trim() ?? "";
  if (c && p) return `${c}, ${p}`;
  return c || p;
}

export function isProvincia(value: string): value is Provincia {
  return (PROVINCIAS as readonly string[]).includes(value);
}

/** Valores viejos tipo "Santa Rosa - La Pampa" o "Santa Rosa, La Pampa". */
export function parseLegacyLocation(
  city?: string | null,
  province?: string | null,
): { city: string; province: string } {
  const p = province?.trim() ?? "";
  if (p && isProvincia(p)) {
    return { city: city?.trim() ?? "", province: p };
  }
  const raw = city?.trim() ?? "";
  if (!raw) return { city: "", province: "" };
  const parts = raw.split(/\s*[-–,]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(" - ");
    if (isProvincia(last)) return { city: first, province: last };
    if (isProvincia(first)) return { city: last, province: first };
  }
  return { city: raw, province: "" };
}
