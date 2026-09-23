import { PROVINCIAS, type Provincia } from "@/lib/clinic/argentina-geo";

/** Valor de select para “todas las localidades” de una provincia. */
export const ALL_LOCALITIES = "__all__";

export type DoctorLocation = {
  province: string;
  /** Vacío = toda la provincia. */
  city?: string;
};

export function formatDoctorLocation(
  city?: string | null,
  province?: string | null,
): string {
  const c = city?.trim() ?? "";
  const p = province?.trim() ?? "";
  if (p && !c) return `Toda ${p}`;
  if (c && p) return `${c}, ${p}`;
  return c || p;
}

export function formatLocationEntry(loc: DoctorLocation): string {
  return formatDoctorLocation(loc.city, loc.province);
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

export function parseLocationLabel(label: string): DoctorLocation | null {
  const raw = label.trim();
  if (!raw) return null;
  if (/^toda\s+/i.test(raw)) {
    const p = raw.replace(/^toda\s+/i, "").trim();
    if (p) return { province: p };
  }
  const parsed = parseLegacyLocation(raw, "");
  if (parsed.province) {
    return parsed.city
      ? { province: parsed.province, city: parsed.city }
      : { province: parsed.province };
  }
  return null;
}

export function normalizeLocations(
  raw: unknown,
  fallbackCity?: string | null,
  fallbackProvince?: string | null,
): DoctorLocation[] {
  const parsed: DoctorLocation[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const province = String(
        (item as { province?: unknown }).province ?? "",
      ).trim();
      if (!province) continue;
      const city = String((item as { city?: unknown }).city ?? "").trim();
      parsed.push(city ? { province, city } : { province });
    }
  }
  if (parsed.length === 0) {
    const legacy = parseLegacyLocation(fallbackCity, fallbackProvince);
    if (legacy.province) {
      parsed.push(
        legacy.city
          ? { province: legacy.province, city: legacy.city }
          : { province: legacy.province },
      );
    } else if (legacy.city) {
      parsed.push({ province: legacy.city });
    }
  }
  const whole = new Set(
    parsed.filter((l) => !l.city).map((l) => l.province.toLowerCase()),
  );
  const out: DoctorLocation[] = [];
  const seen = new Set<string>();
  for (const loc of parsed) {
    if (loc.city && whole.has(loc.province.toLowerCase())) continue;
    const key = `${loc.province.toLowerCase()}|${(loc.city ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

export function doctorMatchesLocationFilter(
  locations: DoctorLocation[],
  displayCities: string[],
  filter: string,
): boolean {
  if (!filter || filter === "all") return true;
  const wanted = parseLocationLabel(filter);
  if (wanted) {
    for (const loc of locations) {
      if (loc.province.toLowerCase() !== wanted.province.toLowerCase()) continue;
      if (!loc.city || !wanted.city) return true;
      if (loc.city.toLowerCase() === wanted.city.toLowerCase()) return true;
    }
  }
  return displayCities.some(
    (c) => c.trim().toLowerCase() === filter.trim().toLowerCase(),
  );
}
