import { useState } from "react";
import { Share2, Check, Home, Phone, Mail, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@nodocore/shared-components";
import type { PortalProperty } from "../hooks/use-portal-properties";
import { PropertyAmenityIconsLarge } from "./amenity-icons";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatPortalPrice,
} from "../lib/portal-filters";
import { usePropertyPhotoUrl } from "@/features/properties/hooks/use-property-photo-url";

interface PropertyDetailDialogProps {
  property: PortalProperty | null;
  onClose: () => void;
}

function buildShareText(property: PortalProperty): string {
  const op = OPERATION_LABELS[property.operation] ?? property.operation;
  const type = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const price = formatPortalPrice(property.sale_price, property.currency);
  const lines = [
    `🏠 ${property.address}`,
    `${type} en ${op} · ${price}`,
  ];
  if (property.rooms || property.total_sqm) {
    const parts = [];
    if (property.rooms) parts.push(`${property.rooms} amb.`);
    if (property.bathrooms) parts.push(`${property.bathrooms} baños`);
    if (property.total_sqm) parts.push(`${property.total_sqm} m²`);
    lines.push(`🛏 ${parts.join(" · ")}`);
  }
  if (property.description) lines.push(`\n${property.description}`);
  return lines.join("\n");
}

export function PropertyDetailDialog({ property, onClose }: PropertyDetailDialogProps) {
  const { data: photoUrl } = usePropertyPhotoUrl(property?.main_photo);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (!property) return null;

  async function handleNativeShare() {
    const text = buildShareText(property!);
    let filesArray: File[] = [];

    if (photoUrl) {
      try {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        const file = new File([blob], 'propiedad.jpg', { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          filesArray = [file];
        }
      } catch (e) {
        // failed to fetch or create file, proceed without it
      }
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ 
          text, 
          title: property!.address,
          ...(filesArray.length > 0 ? { files: filesArray } : {}) 
        });
      } catch {
        // ignore
      }
    }
  }

  function handleShareClick() {
    if (isMobile && typeof navigator.share === "function") {
      handleNativeShare();
    } else {
      setShowShareMenu((prev) => !prev);
    }
  }

  async function handleCopy() {
    const text = buildShareText(property!);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setShowShareMenu(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const text = buildShareText(property!);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    setShowShareMenu(false);
  }

  function handleMail() {
    const text = buildShareText(property!);
    window.location.href = `mailto:?subject=${encodeURIComponent(property!.address)}&body=${encodeURIComponent(text)}`;
    setShowShareMenu(false);
  }

  const statusColor = STATUS_COLORS[property.status] ?? "bg-slate-100 text-slate-700";
  const statusLabel = STATUS_LABELS[property.status] ?? property.status;
  const operationLabel = OPERATION_LABELS[property.operation] ?? property.operation;
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;

  return (
    <Dialog open={!!property} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-lg font-bold leading-tight">
                {property.address}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
                  {statusLabel}
                </span>
                <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy">
                  {operationLabel}
                </span>
                <span className="text-[11px] text-slate2">{typeLabel}</span>
              </DialogDescription>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleShareClick}
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-green-600" />¡Copiado!</>
                ) : (
                  <><Share2 className="h-3.5 w-3.5" />Compartir</>
                )}
              </Button>

              {showShareMenu && !isMobile && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-border bg-card p-1 shadow-md">
                  <button
                    onClick={handleWhatsApp}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar info
                  </button>
                  <button
                    onClick={handleMail}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Mail className="h-4 w-4" />
                    Mail
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Photo */}
        <div className="aspect-video overflow-hidden rounded-lg bg-mist">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={property.address}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Home className="h-16 w-16 text-slate-300" />
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCell label="Precio" value={formatPortalPrice(property.sale_price, property.currency)} highlight />
          {property.rooms ? <InfoCell label="Ambientes" value={String(property.rooms)} /> : null}
          {property.bathrooms ? <InfoCell label="Baños" value={String(property.bathrooms)} /> : null}
          {property.total_sqm ? <InfoCell label="Superficie" value={`${property.total_sqm} m²`} /> : null}
        </div>

        {/* Amenities */}
        <PropertyAmenityIconsLarge property={property} />

        {/* Description */}
        {property.description && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate2">Descripción</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>
        )}

        {/* Owner contact (internal reference) */}
        {property.owner && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-mist/50 px-3 py-2 text-sm text-slate2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>
              Propietario: <span className="font-medium text-foreground">{property.owner.name}</span>
              {property.owner.phone ? ` · ${property.owner.phone}` : ""}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate2">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-brand" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
