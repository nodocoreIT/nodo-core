import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MapPin,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { formatKilometers, formatPrice } from "@/shared/lib/utils";
import { fetchPublicVehicle } from "./lib/public-vehicle-service";
import type { PublicVehicleView } from "./lib/public-vehicle-service";
import { generateWhatsAppMessage } from "@/utils/vehicle-helpers";

export function PublicVehiclePage() {
  const { slug, clienteIdentificador } = useParams<{
    slug: string;
    clienteIdentificador?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicVehicleView | null>(null);
  const [error, setError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug?.trim()) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const result = await fetchPublicVehicle(slug, clienteIdentificador);
        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug, clienteIdentificador]);

  if (loading) {
    return (
      <PublicShell>
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
          <div>
            <p className="text-lg font-semibold text-navy">Cargando vehículo…</p>
            <p className="mt-1 text-sm text-slate2">Un momento por favor.</p>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (error || !data) {
    return (
      <PublicShell>
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
          <div>
            <Car className="mx-auto h-10 w-10 text-slate2/40" />
            <h1 className="mt-4 text-xl font-bold text-navy">Vehículo no disponible</h1>
            <p className="mt-2 text-sm text-slate2 max-w-md">
              Este enlace no es válido, el vehículo no está publicado o fue retirado del stock
              público.
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  const { vehicle, cliente, contacts } = data;
  const title =
    vehicle.socialTitle?.trim() ||
    (vehicle.model.toLowerCase().includes(vehicle.brand.toLowerCase())
      ? vehicle.model
      : `${vehicle.brand} ${vehicle.model}`);
  const whatsappMessage = generateWhatsAppMessage(vehicle, cliente.nombre);
  const dealerWhatsapp = cliente.whatsappNumero.replace(/\D/g, "");
  const dealerWhatsappUrl = dealerWhatsapp
    ? `https://wa.me/${dealerWhatsapp}?text=${whatsappMessage}`
    : "";
  const phoneUrl = cliente.telefono ? `tel:${cliente.telefono}` : "";
  const displayPrice = vehicle.cashPrice ?? vehicle.listPrice;
  const hasPhotos = vehicle.photos.length > 0;

  return (
    <PublicShell clienteNombre={cliente.nombre} logoUrl={cliente.logoUrl}>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* Galería */}
        <section className="overflow-hidden rounded-xl border border-mist bg-white shadow-sm">
          <button
            type="button"
            className="block w-full"
            onClick={() => hasPhotos && setLightboxIndex(0)}
            disabled={!hasPhotos}
          >
            {hasPhotos ? (
              <img
                src={vehicle.photos[0]}
                alt={title}
                className="h-72 w-full object-cover sm:h-80"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center bg-mist sm:h-80">
                <Car className="h-12 w-12 text-slate2/40" />
              </div>
            )}
          </button>
          {vehicle.photos.length > 1 ? (
            <div className="grid grid-cols-3 gap-2 p-2">
              {vehicle.photos.slice(1, 4).map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setLightboxIndex(index + 1)}
                  className="overflow-hidden rounded-md"
                >
                  <img
                    src={photo}
                    alt={`${title} ${index + 2}`}
                    className="h-24 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* Título y precio */}
        <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
              <p className="mt-1 text-base text-slate2">
                {vehicle.year}
                {vehicle.version ? ` · ${vehicle.version}` : ""}
              </p>
            </div>
            {vehicle.showPrice ? (
              <div className="shrink-0">
                <p className="text-2xl font-bold text-brand sm:text-3xl">
                  {formatPrice(displayPrice, vehicle.currency)}
                </p>
                {vehicle.cashPrice && vehicle.cashPrice !== vehicle.listPrice ? (
                  <p className="text-xs text-slate2 mt-1">Precio de contado</p>
                ) : null}
              </div>
            ) : (
              <p className="text-lg font-semibold text-navy">Consultar precio</p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InfoChip icon={Calendar} label="Año" value={String(vehicle.year)} />
            <InfoChip
              icon={Gauge}
              label="Kilómetros"
              value={formatKilometers(vehicle.kilometers)}
            />
            <div className="col-span-2 sm:col-span-1 flex items-center">
              <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                {vehicle.condition === "nuevo" ? "Nuevo" : "Usado"}
              </span>
            </div>
          </div>
        </section>

        {/* Descripción */}
        {vehicle.description ? (
          <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy mb-3">Descripción</h2>
            <p className="whitespace-pre-wrap text-sm text-ink leading-relaxed">
              {vehicle.description}
            </p>
          </section>
        ) : null}

        {vehicle.socialDescription ? (
          <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy mb-3">Más información</h2>
            <p className="whitespace-pre-wrap text-sm text-ink leading-relaxed">
              {vehicle.socialDescription}
            </p>
          </section>
        ) : null}

        {/* Características */}
        {vehicle.features.length > 0 ? (
          <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy mb-3">Características</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {vehicle.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-ink">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Contacto */}
        <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-navy mb-4">Contactanos</h2>

          {contacts.length > 0 ? (
            <div className="space-y-3 mb-4">
              {contacts.map((user) => {
                const userWhatsapp = user.whatsappNumero?.replace(/\D/g, "") ?? "";
                const userWhatsappUrl = userWhatsapp
                  ? `https://wa.me/${userWhatsapp}?text=${whatsappMessage}`
                  : "";
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border border-mist px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {user.profilePhotoUrl ? (
                        <img
                          src={user.profilePhotoUrl}
                          alt={user.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-sm font-semibold text-navy">
                          {user.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy">{user.name}</p>
                        <p className="text-xs text-slate2">Vendedor</p>
                      </div>
                    </div>
                    {userWhatsappUrl ? (
                      <a
                        href={userWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {dealerWhatsappUrl ? (
                <a
                  href={dealerWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  Consultar por WhatsApp
                </a>
              ) : null}
              {phoneUrl ? (
                <a
                  href={phoneUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-medium text-white hover:bg-navy-700 transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  Llamar ahora
                </a>
              ) : null}
            </div>
          )}
        </section>

        {cliente.direccion ? (
          <section className="rounded-xl border border-mist bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy mb-3">Ubicación</h2>
            <div className="flex items-start gap-2 text-sm text-ink">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate2" />
              <p>{cliente.direccion}</p>
            </div>
          </section>
        ) : null}
      </div>

      {lightboxIndex !== null && vehicle.photos[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxIndex(null)}
          role="presentation"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
            onClick={() => setLightboxIndex(null)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {vehicle.photos.length > 1 ? (
            <button
              type="button"
              className="absolute left-4 rounded-full bg-black/60 p-2 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(
                  (lightboxIndex - 1 + vehicle.photos.length) % vehicle.photos.length,
                );
              }}
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          <img
            src={vehicle.photos[lightboxIndex]}
            alt={`${title} ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {vehicle.photos.length > 1 ? (
            <button
              type="button"
              className="absolute right-4 md:right-16 rounded-full bg-black/60 p-2 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % vehicle.photos.length);
              }}
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      ) : null}
    </PublicShell>
  );
}

function PublicShell({
  children,
  clienteNombre,
  logoUrl,
}: {
  children: ReactNode;
  clienteNombre?: string;
  logoUrl?: string;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-mist bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          {logoUrl ? (
            <img src={logoUrl} alt={clienteNombre ?? "Concesionaria"} className="h-8 w-auto" />
          ) : null}
          <p className="text-lg font-bold text-navy">{clienteNombre ?? "Concesionaria"}</p>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-mist bg-white py-6 text-center text-xs text-slate2">
        {clienteNombre ? `Publicado por ${clienteNombre}` : "Publicado por la concesionaria"}
      </footer>
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate2" />
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate2">{label}</p>
        <p className="text-sm font-medium text-navy">{value}</p>
      </div>
    </div>
  );
}
