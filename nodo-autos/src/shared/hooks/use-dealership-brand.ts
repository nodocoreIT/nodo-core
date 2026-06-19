import { useEffect } from "react";
import { useVehicleStore } from "@/store/vehicle-store";

const FALLBACK_BRAND = "Nodo Autos";

/**
 * Dealership display name from org profile (Configuración → Empresa).
 * Falls back to "Nodo Autos" only while data is loading or missing.
 */
export function useDealershipBrand() {
  const currentCliente = useVehicleStore((s) => s.currentCliente);
  const loadInitialData = useVehicleStore((s) => s.loadInitialData);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const name = currentCliente?.nombre?.trim() || FALLBACK_BRAND;

  return {
    name,
    logoUrl: currentCliente?.logoUrl,
    identificador: currentCliente?.identificador,
    isLoaded: Boolean(currentCliente),
  };
}
