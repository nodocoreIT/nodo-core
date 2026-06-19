import type {
  FuelType,
  VehicleCondition,
  VehicleStatus,
} from "@/types";

export const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "disponible", label: "Disponible" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "en_preparacion", label: "En preparación" },
];

export const VEHICLE_CONDITION_OPTIONS: { value: VehicleCondition; label: string }[] = [
  { value: "nuevo", label: "Nuevo" },
  { value: "usado", label: "Usado" },
];

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: "Diésel", label: "Diésel" },
  { value: "Eléctrico", label: "Eléctrico" },
  { value: "Nafta", label: "Nafta" },
  { value: "Nafta/GNC", label: "Nafta/GNC" },
  { value: "GNC", label: "GNC" },
  { value: "Híbrido", label: "Híbrido" },
];

export const TRANSMISSION_OPTIONS: { value: "manual" | "automatica"; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automatica", label: "Automática" },
];
