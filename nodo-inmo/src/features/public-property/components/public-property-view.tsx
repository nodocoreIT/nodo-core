import { useEffect, useState, type ReactNode } from "react";
import {
  Bath,
  BedDouble,
  Car,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  Mail,
  MapPin,
  MoveVertical,
  ParkingCircle,
  PawPrint,
  Phone,
  Ruler,
  TreePine,
  WashingMachine,
  Waves,
  X,
} from "lucide-react";
import {
  OPERATION_LABELS,
  formatPortalPrice,
} from "@/features/portal/lib/portal-filters";
import { cn } from "@/shared/lib/utils";
import type { PublicProperty } from "../hooks/use-public-property";
import {
  publicListingAmenities,
  publicListingLocation,
  publicListingMapQuery,
  publicListingTheme,
  publicListingThemeStyle,
  publicListingTitle,
  publicListingWhatsAppMessage,
  parseAgencyPhones,
  whatsappConsultHref,
} from "../lib/public-listing";

const AMENITY_ICONS: Record<string, ReactNode> = {
  has_pool: <Waves className="h-3.5 w-3.5" />,
  pets_allowed: <PawPrint className="h-3.5 w-3.5" />,
  has_garage: <Car className="h-3.5 w-3.5" />,
  has_garden: <TreePine className="h-3.5 w-3.5" />,
  has_laundry: <WashingMachine className="h-3.5 w-3.5" />,
  has_bbq: <Flame className="h-3.5 w-3.5" />,
  has_elevator: <MoveVertical className="h-3.5 w-3.5" />,
  has_parking: <ParkingCircle className="h-3.5 w-3.5" />,
};
import { PublicPropertyMap } from "./public-property-map";

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
  const phones = parseAgencyPhones(property.agency?.phone);
  const waHref = whatsappConsultHref(
    property.agency?.phone,
    publicListingWhatsAppMessage(property, pageUrl),
  );
  const theme = publicListingTheme(
    property,
    typeof window !== "undefined" ? window.location.search : "",
  );
  const amenities = publicListingAmenities(property);
  const headerMark = property.agency?.logo_url ? (
    <img
      src={property.agency.logo_url}
      alt={property.agency.legal_name ?? "Inmobiliaria"}
      className="h-10 max-h-12 w-auto max-w-[220px] object-contain"
    />
  ) : (
    <p className="font-display text-sm font-semibold tracking-wide">
      {theme.logoType === "text" && theme.brandText
        ? theme.brandText
        : (property.agency?.legal_name ?? "Nodo Inmo")}
    </p>
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
    <div className="min-h-screen pb-24" style={{ ...publicListingThemeStyle(theme), backgroundColor: theme.backgroundColor || "#f5f8fc" }}>
      <header
        className="sticky top-0 z-40 text-white"
        style={{ backgroundColor: `var(--flyer-secondary, ${theme.secondaryColor})` }}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          {headerMark}
          {phones[0] ? (
            <a
              href={`tel:${phones[0]}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">{phones[0]}</span>
            </a>
          ) : null}
        </div>
        <div className="h-1" style={{ backgroundColor: theme.primaryColor }} />
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-8 px-4 py-6">
        <div className="relative h-52 w-full overflow-hidden rounded-2xl bg-navy sm:h-64">
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

        <section className="rounded-2xl bg-white p-5 shadow-lg sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold leading-tight text-navy sm:text-3xl">
                {title}
              </h1>
              {location ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-slate2">
                  <MapPin className="h-4 w-4" style={{ color: theme.primaryColor }} />
                  {property.address} — {location}
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm text-slate2">
                  <MapPin className="h-4 w-4" style={{ color: theme.primaryColor }} />
                  {property.address}
                </p>
              )}
            </div>
            <p
              className="shrink-0 rounded-xl px-4 py-2 text-xl font-bold sm:text-2xl"
              style={{
                backgroundColor: `var(--flyer-primary, ${theme.primaryColor})`,
                color: theme.buttonFontColor || "#fff",
              }}
            >
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

          {amenities.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {amenities.map((item) => (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-slate2"
                >
                  {AMENITY_ICONS[item.key]}
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
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

        {property.agency?.legal_name || property.agency?.phone || property.agency?.email ? (
          <section className="rounded-2xl border border-border bg-mist/40 p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-xl font-bold text-navy">Consultas</h2>
            {property.agency.legal_name ? (
              <p className="mt-2 text-sm font-semibold text-navy">{property.agency.legal_name}</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate2">
              {phones.map((number) => (
                <a
                  key={number}
                  href={`tel:${number}`}
                  className="inline-flex items-center gap-2 hover:text-navy"
                >
                  <Phone className="h-4 w-4" />
                  {number}
                </a>
              ))}
              {property.agency.email ? (
                <a
                  href={`mailto:${property.agency.email}`}
                  className="inline-flex items-center gap-2 hover:text-navy"
                >
                  <Mail className="h-4 w-4" />
                  {property.agency.email}
                </a>
              ) : null}
            </div>
          </section>
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
            <p className="text-sm font-bold" style={{ color: theme.primaryColor }}>{price}</p>
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
          ) : phones[0] ? (
            <a
              href={`tel:${phones[0]}`}
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
