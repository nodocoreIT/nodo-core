import { createServiceClient } from "@/lib/supabase/server";

const CITY = "Santa Rosa";
const ACTOR = "compass~crawler-google-places";

export const DIRECTORY_CATEGORIES = {
  laboratorio: {
    label: "Laboratorios de análisis clínicos",
    searchQuery: "laboratorios de analisis clinicos",
  },
  diagnostico_imagenes: {
    label: "Centros de diagnóstico por imágenes",
    searchQuery: "centro de diagnostico por imagenes radiologia ecografia",
  },
} as const;

export type DirectoryCategory = keyof typeof DIRECTORY_CATEGORIES;

export function isDirectoryCategory(value: string): value is DirectoryCategory {
  return value in DIRECTORY_CATEGORIES;
}

export interface DirectoryEntry {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
}

interface ApifyPlaceItem {
  placeId?: string;
  title?: string;
  address?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  location?: { lat?: number; lng?: number };
}

interface IngestResult {
  ok: boolean;
  count?: number;
  error?: string;
}

/** Trae los negocios de una categoría (laboratorios, diagnóstico por
 * imágenes, etc.) vía Google Maps (actor de Apify "Google Maps Scraper") y
 * los guarda. No rota mes a mes como el turnero de farmacias — el cron solo
 * mantiene el listado al día por si abre/cierra algún local. */
export async function ingestMedicalDirectory(
  city: string,
  category: DirectoryCategory,
): Promise<IngestResult> {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    return { ok: false, error: "APIFY_API_TOKEN no configurada" };
  }

  let items: ApifyPlaceItem[];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [DIRECTORY_CATEGORIES[category].searchQuery],
          locationQuery: `${city}, La Pampa, Argentina`,
          maxCrawledPlacesPerSearch: 20,
          language: "es",
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `Apify respondió ${res.status}` };
    }
    items = (await res.json()) as ApifyPlaceItem[];
  } catch (err) {
    console.error(`[medical-directory:${category}] Apify call failed:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Error al consultar Apify" };
  }

  const entries: DirectoryEntry[] = items
    .filter((item) => item.placeId && item.title)
    .map((item) => ({
      placeId: item.placeId!,
      name: item.title!,
      address: item.address ?? null,
      phone: item.phone ?? item.phoneUnformatted ?? null,
      website: item.website ?? null,
      lat: item.location?.lat ?? null,
      lon: item.location?.lng ?? null,
    }));

  if (entries.length === 0) {
    return { ok: false, error: "Apify no devolvió resultados" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;
  const { error } = await supabase.from("medical_directory").upsert(
    entries.map((entry) => ({
      city,
      category,
      place_id: entry.placeId,
      name: entry.name,
      address: entry.address,
      phone: entry.phone,
      website: entry.website,
      lat: entry.lat,
      lon: entry.lon,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "city,category,place_id" },
  );

  if (error) {
    console.error(`[medical-directory:${category}] upsert failed:`, error);
    return { ok: false, error: error.message };
  }

  return { ok: true, count: entries.length };
}

/** Lee el directorio guardado para (ciudad, categoría) — [] si nunca se ingirió. */
export async function getMedicalDirectory(
  city: string,
  category: DirectoryCategory,
): Promise<DirectoryEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;
  const { data } = await supabase
    .from("medical_directory")
    .select("*")
    .eq("city", city)
    .eq("category", category)
    .order("name");

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => ({
    placeId: row.place_id as string,
    name: row.name as string,
    address: row.address as string | null,
    phone: row.phone as string | null,
    website: row.website as string | null,
    lat: row.lat as number | null,
    lon: row.lon as number | null,
  }));
}

export { CITY as MEDICAL_DIRECTORY_CITY };
