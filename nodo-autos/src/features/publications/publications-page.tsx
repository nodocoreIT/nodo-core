import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Check, Globe, Search, Share2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import { matchesVehicleSearch } from "@/shared/lib/utils";
import type { PublicationChannel, PublicationStatus } from "@/types";
import {
  SOCIAL_PLATFORMS,
  getPublicationForPlatform,
  isPlatformPublished,
} from "@/utils/publication-social";

const LIST_CHANNELS: PublicationChannel[] = ["instagram", "facebook", "website", "mercadolibre"];

const CHANNEL_LABELS: Record<PublicationChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Web",
  mercadolibre: "MercadoLibre",
};

const STATUS_BADGE: Record<PublicationStatus, string> = {
  borrador: "pub-borrador",
  pendiente: "pub-pendiente",
  publicado: "pub-publicado",
  fallido: "pub-fallido",
};

const STATUS_LABEL: Record<PublicationStatus, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  publicado: "Publicado",
  fallido: "Fallido",
};

export function PublicationsPage() {
  const navigate = useNavigate();
  const { vehicles, publications, loadInitialData, loading } = useVehicleStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) => matchesVehicleSearch(vehicle, query));
  }, [vehicles, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Redes Sociales</h2>
          <p className="text-sm text-slate2 mt-1">
            Gestioná la publicación de vehículos en Instagram, Facebook y otros canales.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por patente, marca, modelo…"
            className="pl-9"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-slate2">Cargando…</p>}

      {!loading && filteredVehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Globe className="h-10 w-10 text-slate2-300" />
          <p className="text-slate2">
            {vehicles.length === 0
              ? "No hay vehículos cargados aún."
              : "No se encontraron vehículos con ese criterio."}
          </p>
        </div>
      )}

      {!loading && filteredVehicles.length > 0 && (
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="border-b border-mist">
            <div className="grid grid-cols-[1fr_repeat(4,_minmax(80px,_100px))] gap-4 items-center">
              <CardTitle className="text-xs text-slate2 uppercase tracking-wide">Vehículo</CardTitle>
              {LIST_CHANNELS.map((ch) => (
                <span key={ch} className="text-xs text-slate2 uppercase tracking-wide text-center">
                  {CHANNEL_LABELS[ch]}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-mist">
              {filteredVehicles.map((v) => {
                const vehiclePublications = publications.filter((p) => p.vehicleId === v.id);
                const socialPublishedCount = SOCIAL_PLATFORMS.filter((platform) =>
                  isPlatformPublished(getPublicationForPlatform(publications, v.id, platform)),
                ).length;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate(`/admin/publicaciones/${v.id}`)}
                    className="grid grid-cols-[1fr_repeat(4,_minmax(80px,_100px))] gap-4 items-center px-5 py-3 w-full text-left hover:bg-paper transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-12 flex-shrink-0 overflow-hidden rounded-md bg-mist">
                        {v.photos[0] ? (
                          <img
                            src={v.photos[0]}
                            alt={`${v.brand} ${v.model}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Car className="h-4 w-4 text-slate2-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy group-hover:text-brand transition-colors">
                          {v.brand} {v.model}
                        </p>
                        <p className="text-xs text-slate2 flex items-center gap-2">
                          <span>{v.year}</span>
                          {socialPublishedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <Share2 className="h-3 w-3" />
                              {socialPublishedCount} red{socialPublishedCount > 1 ? "es" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {LIST_CHANNELS.map((ch) => {
                      const pub = vehiclePublications.find((p) => p.channel === ch);
                      const socialPublished =
                        (ch === "instagram" || ch === "facebook") &&
                        isPlatformPublished(
                          getPublicationForPlatform(publications, v.id, ch),
                        );
                      const isPublished =
                        socialPublished || pub?.status === "publicado";

                      return (
                        <div key={ch} className="flex justify-center">
                          {isPublished ? (
                            <span title="Publicado" className="inline-flex items-center justify-center">
                              <Check className="h-5 w-5 text-emerald-600 stroke-[2.5]" />
                            </span>
                          ) : pub && pub.status !== "borrador" ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[pub.status]}`}
                            >
                              {STATUS_LABEL[pub.status]}
                            </span>
                          ) : (
                            <span title="Sin publicar" className="inline-flex items-center justify-center">
                              <X className="h-5 w-5 text-red-400 stroke-[2.5]" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
