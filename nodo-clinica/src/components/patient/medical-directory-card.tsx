"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Phone, MapPin, Navigation, LocateFixed, Globe, type LucideIcon } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { toast } from "sonner";
import { haversineKm } from "@/lib/geo";
import { useUserLocation } from "@/hooks/use-user-location";

interface DirectoryEntry {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
}

type Tone = "sky" | "violet";

const TONE_CLASSES: Record<Tone, {
  header: string;
  icon: string;
  link: string;
  cardBorder: string;
  accent: string;
  badge: string;
  iconBtn: string;
}> = {
  sky: {
    header: "from-sky-50 to-slate-50",
    icon: "text-sky-600",
    link: "text-sky-700",
    cardBorder: "border-sky-100",
    accent: "border-sky-300 bg-sky-50/70",
    badge: "bg-sky-600",
    iconBtn: "text-sky-600 hover:bg-sky-50",
  },
  violet: {
    header: "from-violet-50 to-slate-50",
    icon: "text-violet-600",
    link: "text-violet-700",
    cardBorder: "border-violet-100",
    accent: "border-violet-300 bg-violet-50/70",
    badge: "bg-violet-600",
    iconBtn: "text-violet-600 hover:bg-violet-50",
  },
};

interface MedicalDirectoryCardProps {
  category: string;
  title: string;
  icon: LucideIcon;
  tone: Tone;
  emptyLabel: string;
}

export function MedicalDirectoryCard({ category, title, icon: Icon, tone, emptyLabel }: MedicalDirectoryCardProps) {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { coords: userCoords, locating, locate: locateNearest } = useUserLocation();
  const t = TONE_CLASSES[tone];

  useEffect(() => {
    let cancelled = false;
    clinicApi
      .getMedicalDirectory(category)
      .then((data) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Error al cargar el directorio");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const entriesWithDistance = useMemo(() => {
    const withDistance = entries.map((entry) => ({
      entry,
      distanceKm:
        userCoords && entry.lat != null && entry.lon != null
          ? haversineKm(userCoords, { lat: entry.lat, lon: entry.lon })
          : null,
    }));
    if (!userCoords) return withDistance;
    return [...withDistance].sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [entries, userCoords]);

  return (
    <Card className="border-slate-200">
      <CardHeader className={`py-3 px-4 bg-gradient-to-r ${t.header} border-b`}>
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2 text-slate-700">
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${t.icon}`} />
            {title}
          </span>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={locateNearest}
              disabled={locating}
              className={`inline-flex items-center gap-1 text-[11px] font-medium hover:underline disabled:opacity-50 ${t.link}`}
            >
              {locating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LocateFixed className="h-3 w-3" />
              )}
              {userCoords ? "Actualizar ubicación" : "Ver el más cercano"}
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {entriesWithDistance.map(({ entry, distanceKm }, i) => {
              const mapsQuery = encodeURIComponent(
                `${entry.name} ${entry.address ?? ""}, Santa Rosa, La Pampa`,
              );
              const isNearest = userCoords && i === 0 && distanceKm != null;
              return (
                <div
                  key={entry.placeId}
                  className={`rounded-md border p-2.5 shadow-sm ${isNearest ? t.accent : `${t.cardBorder} bg-white`}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-800">{entry.name}</p>
                        {isNearest && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white ${t.badge}`}>
                            Más cercano · {distanceKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      {entry.address && (
                        <p className="text-[11px] text-slate-500">{entry.address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Cómo llegar (Google Maps)"
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${t.iconBtn}`}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://waze.com/ul?q=${mapsQuery}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Cómo llegar (Waze)"
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${t.iconBtn}`}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    {entry.phone && (
                      <a
                        href={`tel:${entry.phone}`}
                        className={`inline-flex items-center gap-1 text-[11px] hover:underline ${t.link}`}
                      >
                        <Phone className="h-3 w-3" />
                        {entry.phone}
                      </a>
                    )}
                    {entry.website && (
                      <a
                        href={entry.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-[11px] hover:underline ${t.link}`}
                      >
                        <Globe className="h-3 w-3" />
                        Sitio web
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
