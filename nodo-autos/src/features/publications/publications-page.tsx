import { useEffect } from "react";
import { Car, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { useVehicleStore } from "@/store/vehicle-store";
import type { PublicationChannel, PublicationStatus } from "@/types";

const CHANNELS: PublicationChannel[] = ["instagram", "facebook", "website", "mercadolibre"];

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
  const { vehicles, publications, loadInitialData, loading } = useVehicleStore();

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const publishedVehicles = vehicles.filter((v) => v.isPublished || publications.some((p) => p.vehicleId === v.id));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-navy">Publicaciones</h2>

      {loading && <p className="text-sm text-slate2">Cargando…</p>}

      {!loading && publishedVehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Globe className="h-10 w-10 text-slate2-300" />
          <p className="text-slate2">No hay vehículos publicados aún.</p>
        </div>
      )}

      {!loading && publishedVehicles.length > 0 && (
        <Card className="border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="border-b border-mist">
            <div className="grid grid-cols-[1fr_repeat(4,_minmax(80px,_100px))] gap-4 items-center">
              <CardTitle className="text-xs text-slate2 uppercase tracking-wide">Vehículo</CardTitle>
              {CHANNELS.map((ch) => (
                <span key={ch} className="text-xs text-slate2 uppercase tracking-wide text-center">
                  {CHANNEL_LABELS[ch]}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-mist">
              {publishedVehicles.map((v) => {
                const vehiclePublications = publications.filter((p) => p.vehicleId === v.id);

                return (
                  <div
                    key={v.id}
                    className="grid grid-cols-[1fr_repeat(4,_minmax(80px,_100px))] gap-4 items-center px-5 py-3"
                  >
                    {/* Vehicle info */}
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
                        <p className="truncate text-sm font-semibold text-navy">
                          {v.brand} {v.model}
                        </p>
                        <p className="text-xs text-slate2">{v.year}</p>
                      </div>
                    </div>

                    {/* Channel badges */}
                    {CHANNELS.map((ch) => {
                      const pub = vehiclePublications.find((p) => p.channel === ch);
                      return (
                        <div key={ch} className="flex justify-center">
                          {pub ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[pub.status]}`}
                            >
                              {STATUS_LABEL[pub.status]}
                            </span>
                          ) : (
                            <span className="text-xs text-slate2-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
