import { useEffect, useState, type ReactNode } from "react";
import {
  Bath,
  BedDouble,
  Car,
  ChevronLeft,
  ChevronRight,
  Home,
  Mail,
  MapPin,
  Phone,
  Ruler,
  X,
} from "lucide-react";
import { PropertyAmenityIconsLarge } from "@/features/portal/components/amenity-icons";
import type { PortalProperty } from "@/features/portal/hooks/use-portal-properties";
import {
  OPERATION_LABELS,
  formatPortalPrice,
} from "@/features/portal/lib/portal-filters";
import { cn } from "@/shared/lib/utils";
import type { PublicProperty } from "../hooks/use-public-property";
import {
  publicListingLocation,
  publicListingMapQuery,
  publicListingTitle,
  publicListingWhatsAppMessage,
  whatsappConsultHref,
} from "../lib/public-listing";
import { PublicPropertyMap } from "./public-property-map";

function toAmenityShape(property: PublicProperty): PortalProperty {
  return property as unknown as PortalProperty;
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
      <span className="text-navy/70">{icon}</span>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate2">{label}</p>
      <p className="text-lg font-semibold text-navy">{value}</p>
    </div>
  );
}

export function PublicPropertyView({ property }: { property: PublicProperty }) {
  const photos = property.photo_urls;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const operationLabel = OPERATION_LABELS[property.operation] ?? property.operation;
  const title = publicListingTitle(property);
  const location = publicListingLocation(property);
  const price = formatPortalPrice(property.sale_price, property.currency);
  const mainPhoto = photos[activeIndex];
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const waHref = whatsappConsultHref(
    property.agency?.phone,
    publicListingWhatsAppMessage(property, pageUrl),
  );

  function prevPhoto() {
    if (photos.length < 2) return;
    setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function nextPhoto() {
    if (photos.length < 2) return;
    setActiveIndex((i) => (i + 1) % photos.length);
  }

  useEffect(() => {
    document.title = `${title} · ${property.agency?.legal_name ?? "Nodo Inmo"}`;
  }, [title, property.agency?.legal_name]);

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
    <div className="min-h-screen bg-paper pb-24">
      <header className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          {property.agency?.logo_url ? (
            <img
              src={property.agency.logo_url}
              alt={property.agency.legal_name ?? "Inmobiliaria"}
              className="h-10 max-w-[180px] object-contain"
            />
          ) : (
            <p className="font-display text-sm font-semibold tracking-wide">
              {property.agency?.legal_name ?? "Nodo Inmo"}
            </p>
          )}
          {property.agency?.phone ? (
            <a
              href={`tel:${property.agency.phone}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-300 hover:text-white"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">{property.agency.phone}</span>
            </a>
          ) : null}
        </div>
        <div className="h-1 bg-brand" />
      </header>

      <div className="relative aspect-[16/10] w-full bg-navy sm:aspect-[2.2/1]">
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
          <div className="flex h-full items-center justify-center">
            <Home className="h-16 w-16 text-white/30" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
          {operationLabel}
        </span>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      <main className="relative z-10 mx-auto -mt-10 max-w-5xl space-y-10 px-4">
        <section className="rounded-2xl bg-white p-5 shadow-lg sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold leading-tight text-navy sm:text-3xl">
                {title}
              </h1>
              {location ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-slate2">
                  <MapPin className="h-4 w-4 text-brand" />
                  {property.address} — {location}
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm text-slate2">
                  <MapPin className="h-4 w-4 text-brand" />
                  {property.address}
                </p>
              )}
            </div>
            <p className="shrink-0 rounded-xl bg-brand px-4 py-2 text-xl font-bold text-white sm:text-2xl">
              {price}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 divide-y divide-mist rounded-xl border border-mist sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {property.rooms != null ? (
              <Stat icon={<BedDouble className="h-5 w-5" />} label="Ambientes" value={String(property.rooms)} />
            ) : null}
            {property.bathrooms != null ? (
              <Stat icon={<Bath className="h-5 w-5" />} label="Baños" value={String(property.bathrooms)} />
            ) : null}
            {property.has_garage || property.has_parking ? (
              <Stat icon={<Car className="h-5 w-5" />} label="Cocheras" value="1" />
            ) : null}
            {property.total_sqm != null ? (
              <Stat icon={<Ruler className="h-5 w-5" />} label="Superficie" value={`${property.total_sqm} m²`} />
            ) : null}
          </div>
        </section>

        {property.description ? (
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-bold text-navy">Descripción</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-navy/80">
              {property.description}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-bold text-navy">Características</h2>
          <div className="mt-4">
            <PropertyAmenityIconsLarge property={toAmenityShape(property)} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
          <h2 className="font-display text-xl font-bold text-navy">Ubicación</h2>
          <p className="mt-1 text-sm text-slate2">{publicListingMapQuery(property)}</p>
          <div className="mt-4">
            <PublicPropertyMap query={publicListingMapQuery(property)} />
          </div>
        </section>

        {photos.length > 0 ? (
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-bold text-navy">Galería de fotos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setLightboxOpen(true);
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    index === activeIndex ? "ring-2 ring-brand" : "hover:opacity-90",
                  )}
                  aria-label={`Ver foto ${index + 1}`}
                >
                  <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {property.agency?.email ? (
          <p className="text-center text-sm text-slate2">
            <a href={`mailto:${property.agency.email}`} className="inline-flex items-center gap-1.5 hover:text-navy">
              <Mail className="h-3.5 w-3.5" />
              {property.agency.email}
            </a>
          </p>
        ) : null}
      </main>

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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-white/95 shadow-[0_-8px_24px_rgba(18,30,47,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{property.address}</p>
            <p className="text-sm font-bold text-brand">{price}</p>
          </div>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-600"
            >
              Consultar por WhatsApp
            </a>
          ) : property.agency?.phone ? (
            <a
              href={`tel:${property.agency.phone}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white"
            >
              Llamar
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
