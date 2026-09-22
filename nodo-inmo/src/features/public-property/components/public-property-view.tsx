import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Home, Mail, Phone, X } from "lucide-react";
import { PropertyAmenityIconsLarge } from "@/features/portal/components/amenity-icons";
import type { PortalProperty } from "@/features/portal/hooks/use-portal-properties";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  formatPortalPrice,
} from "@/features/portal/lib/portal-filters";
import { cn } from "@/shared/lib/utils";
import type { PublicProperty } from "../hooks/use-public-property";

function toAmenityShape(property: PublicProperty): PortalProperty {
  return property as unknown as PortalProperty;
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

export function PublicPropertyView({ property }: { property: PublicProperty }) {
  const photos = property.photo_urls;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const statusColor = STATUS_COLORS[property.status] ?? "bg-slate-100 text-slate-700";
  const statusLabel = STATUS_LABELS[property.status] ?? property.status;
  const operationLabel = OPERATION_LABELS[property.operation] ?? property.operation;
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type;
  const mainPhoto = photos[activeIndex];
  const location = [property.localidad, property.provincia].filter(Boolean).join(", ");

  function prevPhoto() {
    if (photos.length < 2) return;
    setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function nextPhoto() {
    if (photos.length < 2) return;
    setActiveIndex((i) => (i + 1) % photos.length);
  }

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "Escape") setLightboxOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate2">Ficha pública</p>
        <h1 className="text-2xl font-bold leading-tight text-foreground">{property.address}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy">
            {operationLabel}
          </span>
          <span className="text-[11px] text-slate2">{typeLabel}</span>
        </div>
        {location ? <p className="text-sm text-slate2">📍 {location}</p> : null}
      </header>

      <div className="relative aspect-video overflow-hidden rounded-lg bg-mist">
        {mainPhoto ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="h-full w-full"
            aria-label="Ver foto en grande"
          >
            <img src={mainPhoto} alt={property.address} className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Home className="h-16 w-16 text-slate-300" />
          </div>
        )}
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "overflow-hidden rounded-md ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                index === activeIndex ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100",
              )}
              aria-label={`Ver foto ${index + 1}`}
              aria-current={index === activeIndex}
            >
              <img src={url} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen && mainPhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {photos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          <img
            src={mainPhoto}
            alt={property.address}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCell
          label="Precio"
          value={formatPortalPrice(property.sale_price, property.currency)}
          highlight
        />
        {property.rooms ? <InfoCell label="Ambientes" value={String(property.rooms)} /> : null}
        {property.bathrooms ? <InfoCell label="Baños" value={String(property.bathrooms)} /> : null}
        {property.total_sqm ? <InfoCell label="Superficie" value={`${property.total_sqm} m²`} /> : null}
      </div>

      <PropertyAmenityIconsLarge property={toAmenityShape(property)} />

      {property.description ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate2">Descripción</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {property.description}
          </p>
        </div>
      ) : null}

      {property.agency?.legal_name || property.agency?.phone || property.agency?.email ? (
        <div className="rounded-lg border border-border bg-mist/40 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate2">Consultas</p>
          {property.agency.legal_name ? (
            <p className="text-sm font-semibold text-foreground">{property.agency.legal_name}</p>
          ) : null}
          <div className="flex flex-col gap-1 text-sm text-slate2">
            {property.agency.phone ? (
              <a href={`tel:${property.agency.phone}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Phone className="h-3.5 w-3.5" />
                {property.agency.phone}
              </a>
            ) : null}
            {property.agency.email ? (
              <a href={`mailto:${property.agency.email}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" />
                {property.agency.email}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
