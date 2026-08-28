"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Cross, Phone, ExternalLink, MapPin, Navigation, LocateFixed } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { toast } from "sonner";
import { haversineKm } from "@/lib/geo";
import { useUserLocation } from "@/hooks/use-user-location";

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const MES_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface PharmacyEntry {
  name: string;
  address: string;
  phones: string[];
  lat?: number;
  lon?: number;
}

interface Schedule {
  dayLetters: Record<string, string>;
  letterPharmacies: Record<string, PharmacyEntry[]>;
  sourcePdfUrl: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function PharmacyOnCallCard() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const { coords: userCoords, locating, locate: locateNearest } = useUserLocation();

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    clinicApi
      .getPharmacyOnCallSchedule(viewYear, viewMonth)
      .then((data) => {
        if (cancelled) return;
        setSchedule(data.schedule);
        setSelectedDay(isCurrentMonth ? today.getDate() : 1);
      })
      .catch((err) => {
        if (cancelled) return;
        setSchedule(null);
        toast.error(err instanceof Error ? err.message : "Error al cargar farmacias de turno");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth]);

  function goToMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const total = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const selectedLetter = schedule?.dayLetters[String(selectedDay)];
  const selectedPharmacies = selectedLetter
    ? schedule?.letterPharmacies[selectedLetter] ?? []
    : [];

  const pharmaciesWithDistance = useMemo(() => {
    const withDistance = selectedPharmacies.map((pharmacy) => ({
      pharmacy,
      distanceKm:
        userCoords && pharmacy.lat != null && pharmacy.lon != null
          ? haversineKm(userCoords, { lat: pharmacy.lat, lon: pharmacy.lon })
          : null,
    }));
    if (!userCoords) return withDistance;
    return [...withDistance].sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPharmacies, userCoords]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-50 to-slate-50 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
          <Cross className="h-4 w-4 text-emerald-600" />
          Farmacia de turno — Santa Rosa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700">
            {MES_LABELS[viewMonth - 1]} {viewYear}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !schedule ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Todavía no se publicó el turnero de {MES_LABELS[viewMonth - 1].toLowerCase()}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={i} className="text-[10px] font-semibold text-slate-400 pb-1">
                  {label}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const letter = schedule.dayLetters[String(day)];
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`rounded-md py-1 text-xs flex flex-col items-center gap-0.5 transition-colors ${
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : isToday
                          ? "bg-emerald-50 text-emerald-800 font-semibold"
                          : "hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span>{day}</span>
                    {letter && (
                      <span className={`text-[9px] ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                        {letter}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-emerald-900">
                  {isCurrentMonth && selectedDay === today.getDate() ? "Hoy" : `Día ${selectedDay}`}
                  {selectedLetter ? ` — Turno ${selectedLetter}` : ""}
                </p>
                {selectedPharmacies.length > 0 && (
                  <button
                    type="button"
                    onClick={locateNearest}
                    disabled={locating}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    {locating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3 w-3" />
                    )}
                    {userCoords ? "Actualizar ubicación" : "Ver la más cercana"}
                  </button>
                )}
              </div>
              {selectedPharmacies.length === 0 ? (
                <p className="text-xs text-slate-400">Sin datos para este día.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pharmaciesWithDistance.map(({ pharmacy, distanceKm }, i) => {
                    const mapsQuery = encodeURIComponent(
                      `${pharmacy.name} ${pharmacy.address}, Santa Rosa, La Pampa`,
                    );
                    const isNearest = userCoords && i === 0 && distanceKm != null;
                    return (
                      <div
                        key={i}
                        className={`rounded-md border p-2.5 shadow-sm ${
                          isNearest ? "border-emerald-300 bg-emerald-50/70" : "border-emerald-100 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-slate-800">{pharmacy.name}</p>
                              {isNearest && (
                                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                                  Más cercana · {distanceKm.toFixed(1)} km
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">{pharmacy.address}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Cómo llegar (Google Maps)"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={`https://waze.com/ul?q=${mapsQuery}&navigate=yes`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Cómo llegar (Waze)"
                              className="flex h-6 w-6 items-center justify-center rounded-full text-sky-600 hover:bg-sky-50"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {pharmacy.phones.map((phone, j) => (
                            <a
                              key={j}
                              href={`tel:${phone}`}
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {phone}
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <a
              href={schedule.sourcePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
            >
              <ExternalLink className="h-3 w-3" />
              Ver PDF original
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
