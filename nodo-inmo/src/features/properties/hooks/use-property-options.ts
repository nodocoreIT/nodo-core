import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { LOCALIDADES_BY_PROVINCIA, type Provincia } from "@/shared/data/argentina-geo";

const DEFAULT_PROPERTY_TYPES = [
  "Departamento",
  "Casa",
  "Local comercial",
  "Terreno",
  "Oficina",
  "Quinta",
  "Campo",
  "Galpon",
  "Cochera",
  "PH",
] as const;

async function fetchDistinctPropertyOptions() {
  const { data, error } = await supabase
    .schema("nodo_inmo")
    .from("properties")
    .select("property_type, localidad, provincia");

  if (error) throw error;

  const rows = data ?? [];

  const customTypes = new Set<string>();
  const customLocalidades = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.property_type) customTypes.add(row.property_type);
    if (row.provincia && row.localidad) {
      if (!customLocalidades.has(row.provincia)) {
        customLocalidades.set(row.provincia, new Set());
      }
      customLocalidades.get(row.provincia)!.add(row.localidad);
    }
  }

  return { customTypes, customLocalidades };
}

export function usePropertyTypes() {
  return useQuery({
    queryKey: ["nodo_inmo", "property-options", "types"],
    queryFn: async () => {
      const { customTypes } = await fetchDistinctPropertyOptions();

      const merged = new Set([...DEFAULT_PROPERTY_TYPES, ...customTypes]);
      return Array.from(merged).sort((a, b) => a.localeCompare(b, "es"));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLocalidadesByProvincia(provincia: Provincia | undefined) {
  return useQuery({
    queryKey: ["nodo_inmo", "property-options", "localidades", provincia],
    queryFn: async () => {
      if (!provincia) return [];

      const { customLocalidades } = await fetchDistinctPropertyOptions();

      const staticList = LOCALIDADES_BY_PROVINCIA[provincia] ?? [];
      const customList = customLocalidades.get(provincia) ?? new Set();

      const merged = new Set([...staticList, ...customList]);
      return Array.from(merged).sort((a, b) => a.localeCompare(b, "es"));
    },
    enabled: !!provincia,
    staleTime: 1000 * 60 * 5,
  });
}
