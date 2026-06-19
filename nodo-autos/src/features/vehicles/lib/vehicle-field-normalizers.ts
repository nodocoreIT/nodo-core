import type { FuelType, VehicleCondition, VehicleStatus, Currency } from "@/types";

const FUEL_TYPES: FuelType[] = [
  "Diésel",
  "Eléctrico",
  "Nafta",
  "Nafta/GNC",
  "GNC",
  "Híbrido",
];

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function normalizeFuelType(value: string | undefined | null): FuelType {
  const raw = (value ?? "").trim();
  if (FUEL_TYPES.includes(raw as FuelType)) return raw as FuelType;

  const normalized = normalizeKey(raw);
  if (["diesel", "gasoil"].includes(normalized)) return "Diésel";
  if (["electrico", "electrica"].includes(normalized)) return "Eléctrico";
  if (["nafta", "gasolina"].includes(normalized)) return "Nafta";
  if (["naftagnc", "nafta/gnc", "nafta-gnc"].includes(normalized)) return "Nafta/GNC";
  if (normalized === "gnc") return "GNC";
  if (["hibrido", "hibrida", "hybrid"].includes(normalized)) return "Híbrido";

  return "Nafta";
}

export function normalizeTransmission(
  value: string | undefined | null,
): "manual" | "automatica" | undefined {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;

  const normalized = normalizeKey(raw);
  if (["manual", "m"].includes(normalized)) return "manual";
  if (["automatica", "automatico", "auto"].includes(normalized)) return "automatica";

  return undefined;
}

export function normalizeVehicleCondition(
  value: string | undefined | null,
): VehicleCondition {
  const normalized = normalizeKey(value ?? "");
  if (["nuevo", "0km"].includes(normalized)) return "nuevo";
  return "usado";
}

export function normalizeVehicleStatus(
  value: string | undefined | null,
): VehicleStatus {
  const normalized = normalizeKey(value ?? "");
  if (normalized === "disponible") return "disponible";
  if (["reservado", "reservada"].includes(normalized)) return "reservado";
  if (["vendido", "vendida"].includes(normalized)) return "vendido";
  if (["enpreparacion", "preparacion", "en_preparacion"].includes(normalized)) {
    return "en_preparacion";
  }
  return "disponible";
}

export function normalizeCurrency(value: string | undefined | null): Currency {
  const normalized = normalizeKey(value ?? "");
  if (["usd", "us$", "dolares", "dolar"].includes(normalized)) return "USD";
  return "ARS";
}

export function normalizeOwnerType(
  value: string | undefined | null,
): "own" | "consignment" {
  const normalized = normalizeKey(value ?? "");
  if (["consignment", "consignacion"].includes(normalized)) return "consignment";
  return "own";
}

export function normalizeDoors(value: number | string | undefined | null): 3 | 4 | 5 | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (n === 3 || n === 4 || n === 5) return n;
  return undefined;
}

export function resolveFormSelectValue(
  value: string | undefined,
  options: readonly { value: string }[],
  allowEmpty = false,
): string {
  const safe = value ?? "";
  if (safe !== "" && options.some((option) => option.value === safe)) return safe;
  if (allowEmpty) return "";
  return options[0]?.value ?? "";
}
