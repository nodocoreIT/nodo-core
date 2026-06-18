import type { InmoPropertyOption } from "@/lib/obra/types";

/** Catálogo demo alineado con propiedades típicas de nodo-inmo. */
export const MOCK_INMO_PROPERTIES: InmoPropertyOption[] = [
  {
    id: "inmo-prop-thames-1450",
    address: "Thames 1450, Palermo, CABA",
    propertyType: "PH",
    ownerName: "María González",
    status: "disponible",
  },
  {
    id: "inmo-prop-ayacucho-1200",
    address: "Ayacucho 1200, Recoleta, CABA",
    propertyType: "Departamento",
    ownerName: "María González",
    status: "disponible",
  },
  {
    id: "inmo-prop-nordelta-320",
    address: "Los Castores 320, Nordelta, Tigre",
    propertyType: "Casa",
    ownerName: "María González",
    status: "en_obra",
  },
  {
    id: "inmo-prop-obligado-2100",
    address: "Vuelta de Obligado 2100, Belgrano, CABA",
    propertyType: "Casa",
    ownerName: "María González",
    status: "disponible",
  },
];

export async function listInmoProperties(): Promise<InmoPropertyOption[]> {
  const apiUrl = process.env.NODO_INMO_API_URL?.trim();
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/properties`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = (await res.json()) as InmoPropertyOption[];
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      /* fallback to mock */
    }
  }
  return MOCK_INMO_PROPERTIES;
}

export function findInmoProperty(id: string | null | undefined) {
  if (!id) return null;
  return MOCK_INMO_PROPERTIES.find((p) => p.id === id) ?? null;
}

export function formatInmoPropertyLabel(property: InmoPropertyOption) {
  return `${property.address} (${property.propertyType})`;
}
