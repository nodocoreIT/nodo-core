import {
  searchMedications as searchLocalMedications,
  type MedicationCatalogEntry,
  type MedicationSearchResponse,
} from "@/lib/clinic/medication-catalog";

const DEFAULT_VADEMECUM_API =
  "https://api.argly.com.ar/v1/medicamentos";

interface ArglyMedicationRow {
  nombre: string;
  presentacion: string;
  laboratorio: string;
  precio: number;
  tipo_venta: string;
  forma: string;
  via: string;
  accion: string;
  droga: string;
}

function slugId(nombre: string, presentacion: string): string {
  return `${nombre}-${presentacion}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80);
}

function mapArglyRow(row: ArglyMedicationRow): MedicationCatalogEntry {
  const presentation = `${row.presentacion} (${row.laboratorio})`;
  return {
    id: slugId(row.nombre, row.presentacion),
    name: `${row.nombre} — ${row.presentacion}`,
    activeIngredient: row.droga,
    presentations: [presentation],
    defaultDosage: row.presentacion.includes("mg")
      ? row.presentacion.match(/\d+\s*mg/i)?.[0] ?? "Según indicación"
      : "Según indicación",
    defaultFrequency: "Según indicación médica",
    defaultDuration: "Según indicación médica",
    category: row.accion || row.forma,
    laboratorio: row.laboratorio,
    precio: row.precio,
    tipoVenta: row.tipo_venta,
  };
}

async function searchArglyVademecum(
  query: string,
  limit: number,
): Promise<MedicationCatalogEntry[]> {
  const baseUrl = process.env.VADEMECUM_API_URL?.trim() || DEFAULT_VADEMECUM_API;
  const url = new URL(baseUrl);
  url.searchParams.set("nombre", query.trim());

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Vademécum API ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: { results?: ArglyMedicationRow[] };
  };

  const rows = json.data?.results ?? [];
  const seen = new Set<string>();
  const results: MedicationCatalogEntry[] = [];

  for (const row of rows) {
    const key = `${row.nombre}|${row.presentacion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(mapArglyRow(row));
    if (results.length >= limit) break;
  }

  return results;
}

export async function searchVademecum(
  query: string,
  limit = 12,
): Promise<MedicationSearchResponse> {
  const q = query.trim();
  if (!q || q.length < 2) {
    return { results: [], source: "vademecum" };
  }

  const useNational =
    process.env.VADEMECUM_DISABLE !== "true" &&
    process.env.VADEMECUM_DISABLE !== "1";

  if (useNational) {
    try {
      const results = await searchArglyVademecum(q, limit);
      if (results.length > 0) {
        return {
          results,
          source: "vademecum-nacional",
          hint: `Vademécum nacional — ${results.length} resultado(s)`,
        };
      }
    } catch (err) {
      console.error("[vademecum] national search failed", err);
    }
  }

  const local = searchLocalMedications(q, limit);
  return {
    results: local,
    source: local.length ? "local-fallback" : "none",
    hint:
      local.length === 0
        ? "Sin coincidencias. Podés escribir el medicamento manualmente."
        : undefined,
  };
}
