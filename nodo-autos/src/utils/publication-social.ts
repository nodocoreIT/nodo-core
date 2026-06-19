import type { Publication, SocialPlatformKey, Vehicle } from "@/types";

export const OBSOLETE_DAYS = 7;

export const SOCIAL_PLATFORMS: SocialPlatformKey[] = ["instagram", "facebook"];

export const PLATFORM_LABELS: Record<SocialPlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

export const PLATFORM_LOGOS: Record<SocialPlatformKey, string> = {
  instagram: "/autos/instagram.jpeg",
  facebook: "/autos/facebook.png",
};

export function defaultVehicleTitle(vehicle: Vehicle): string {
  return `${vehicle.brand} ${vehicle.model} ${vehicle.version || ""} ${vehicle.year}`.trim();
}

export function generateTechnicalDescription(vehicle: Vehicle): string {
  const specs = [vehicle.brand, vehicle.model, vehicle.version, String(vehicle.year)]
    .filter(Boolean)
    .join(" ");
  const details = [
    vehicle.kilometers ? `${vehicle.kilometers.toLocaleString("es-AR")} km` : "0 km",
    vehicle.fuelType,
    vehicle.engine ? `Motor ${vehicle.engine}` : "",
    vehicle.transmission === "automatica"
      ? "Automática"
      : vehicle.transmission === "manual"
        ? "Manual"
        : "",
    vehicle.doors ? `${vehicle.doors} puertas` : "",
    vehicle.color || "",
    vehicle.singleOwner ? "Único dueño" : "",
  ]
    .filter(Boolean)
    .join(" | ");
  const features =
    vehicle.features.length > 0
      ? `\n\nEquipamiento:\n- ${vehicle.features.join("\n- ")}`
      : "";

  return `${specs}\n${details}${features}`;
}

export function getPublicationForPlatform(
  publications: Publication[],
  vehicleId: string,
  platform: SocialPlatformKey,
): Publication | undefined {
  return publications.find((p) => p.vehicleId === vehicleId && p.channel === platform);
}

export function isPlatformPublished(pub: Publication | undefined): boolean {
  return pub?.status === "publicado" && Boolean(pub.externalId);
}

export function getDaysSincePublication(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const published = new Date(timestamp);
  const now = new Date();
  return Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysText(days: number): string {
  if (days >= OBSOLETE_DAYS) return `Obsoleto (${days} días)`;
  if (days === 0) return "Publicado hoy";
  if (days === 1) return "Publicado hace 1 día";
  return `Publicado hace ${days} días`;
}

export function getDaysColorClass(days: number): string {
  if (days >= OBSOLETE_DAYS) return "text-red-700 font-bold uppercase";
  if (days >= 4) return "text-amber-600";
  return "text-emerald-600";
}

export function formatVehicleLabel(vehicle: Vehicle): string {
  const version = vehicle.version ? ` ${vehicle.version}` : "";
  return `${vehicle.brand} ${vehicle.model}${version} · ${vehicle.year}`;
}
