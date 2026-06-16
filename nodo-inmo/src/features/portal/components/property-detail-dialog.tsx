import { useState } from "react";
import { Share2, Check, Home, Phone, MessageCircle, Mail, Copy } from "lucide-react";
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
                    <MessageCircle className="h-4 w-4 text-green-600" />
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
