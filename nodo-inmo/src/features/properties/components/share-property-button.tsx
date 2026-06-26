import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { PropertyRow } from "@/features/properties/hooks/use-properties";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPrice,
} from "@/features/properties/lib/property-labels";

function buildShareText(property: PropertyRow, coverPhotoUrl?: string | null): string {
  const op = OPERATION_LABELS[property.operation] ?? property.operation;
  const type = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const price = formatPrice(property.sale_price, property.currency);

  const lines: string[] = [];

  // Header: Address
  lines.push(`🏠 ${property.address}`);

  // Type, operation, price
  lines.push(`${type} en ${op} · ${price}`);
  lines.push("");

  // Specs: sqm, rooms, bathrooms
  const specs: string[] = [];
  if ((property as any).total_sqm) specs.push(`📐 ${property.total_sqm}m²`);
  if (property.rooms) specs.push(`🛏 ${property.rooms} amb.`);
  if ((property as any).bathrooms) specs.push(`🚿 ${property.bathrooms} baños`);
  if (specs.length > 0) lines.push(specs.join("   "));

  // Location
  const location: string[] = [];
  if ((property as any).localidad) location.push(property.localidad);
  if ((property as any).provincia) location.push(property.provincia);
  if (location.length > 0) lines.push(`📍 ${location.join(", ")}`);

  // Amenities
  const amenities: string[] = [];
  if ((property as any).has_pool) amenities.push("Pileta");
  if ((property as any).has_garage) amenities.push("Garaje");
  if ((property as any).has_garden) amenities.push("Jardín");
  if ((property as any).has_laundry) amenities.push("Lavadero");
  if ((property as any).has_bbq) amenities.push("Parrilla");
  if ((property as any).has_elevator) amenities.push("Ascensor");
  if ((property as any).has_parking) amenities.push("Estacionamiento");
  if ((property as any).pets_allowed) amenities.push("Mascotas");
  if (amenities.length > 0) lines.push(`✅ ${amenities.join(" · ")}`);

  // Description
  if (property.description) {
    lines.push("");
    lines.push(property.description);
  }

  // Cover photo (desktop only)
  if (coverPhotoUrl) {
    lines.push("");
    lines.push(`📸 Foto: ${coverPhotoUrl}`);
  }

  // Instagram
  if ((property as any).instagram_url) {
    lines.push("");
    lines.push(`📱 Instagram: ${property.instagram_url}`);
  }

  return lines.join("\n");
}

async function fetchCoverPhotoFile(path: string): Promise<File | null> {
  try {
    const { data, error } = await supabase.storage
      .from("property-photos")
      .createSignedUrl(path, 60);
    if (error || !data) return null;

    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    const ext = path.split(".").pop() ?? "jpg";
    return new File([blob], `portada.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

async function fetchCoverPhotoUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("property-photos")
      .createSignedUrl(path, 60);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

interface SharePropertyButtonProps {
  property: PropertyRow;
}

export function SharePropertyButton({ property }: SharePropertyButtonProps) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const title = property.address;
      const photos = (property as unknown as { photos?: string[] }).photos;
      const coverPath = photos?.[0] ?? property.main_photo ?? null;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // Mobile: try native share sheet with cover photo
      if (isMobile && coverPath) {
        const file = await fetchCoverPhotoFile(coverPath);
        const text = buildShareText(property);
        if (
          file &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({ files: [file], title, text });
          return;
        }
      }

      // Mobile without file support: text-only native share
      if (isMobile && typeof navigator.share === "function") {
        const text = buildShareText(property);
        await navigator.share({ title, text });
        return;
      }

      // Desktop: WhatsApp web with text + cover photo URL
      let coverPhotoUrl: string | null = null;
      if (coverPath) {
        coverPhotoUrl = await fetchCoverPhotoUrl(coverPath);
      }
      const text = buildShareText(property, coverPhotoUrl);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noreferrer",
      );
    } catch {
      // User cancelled — do nothing
    } finally {
      setSharing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Compartir propiedad"
      disabled={sharing}
      onClick={() => void handleShare()}
    >
      {sharing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span className="sr-only">Compartir</span>
    </Button>
  );
}
